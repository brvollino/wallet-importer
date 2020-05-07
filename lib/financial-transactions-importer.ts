'use strict';

import Fuse from 'fuse.js';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ImportFileConfig } from './cli/import-file-config';
import { FileLoader } from './file-loader';
import { Account, Category, Currency, FinancesManagerService, Transaction } from './finances-manager-service';
import { OfxTransaction } from './ofx/ofx-file-loader';
const fs = require('fs');

export class FinancialTransactionsImporter {
    constructor(
        private logger: any, 
        private fileLoader: FileLoader,
        private financesService: FinancesManagerService) { }

    async import(apiAuth: any, maxDate: string, dryRun: boolean, files: ImportFileConfig[]) {
        this.logger.info('Importing files: dryRun: %s, files: %o', dryRun, files);
        let transactions: OfxTransaction[] = await this.fileLoader.loadTransactions(files);
        transactions = transactions.sort((t1: any, t2: any) => {
            return t1.date.diff(t2.date);
        });
        const max = moment(maxDate).endOf('day');
        transactions = transactions.filter((tr: any) => tr.date.isSameOrBefore(max));

        const accounts = await this.financesService.getAccounts(apiAuth);
        const currencies = await this.financesService.getCurrencies(apiAuth);
        const categories = await this.financesService.getCategories(apiAuth);
        this.logger.info({
            accounts: accounts,
            categories: categories,
            currencies: currencies
        });

        const allRecords = await this.financesService.getAllTransactions(apiAuth);
        const recordsFuseSearch = getFuseSearch(allRecords, ['note']);

        detectTransfers(transactions, recordsFuseSearch);

        fs.writeFile('transactions.json', JSON.stringify(transactions, null, 2));

        const records = convertToTransactions(
            transactions,
            accounts,
            categories,
            currencies,
            recordsFuseSearch
        );

        fs.writeFile('wallet_records.json', JSON.stringify(records, null, 2));

        if (!dryRun) {
            this.financesService.writeRecords(apiAuth, records);
        }
    }
}

function getPaymentType(transaction: any) {
    switch (transaction.account.type) {
        case 'credit_card':
            return transaction.amount > 0 ? 'transfer' : 'credit_card';
        case 'checking':
            return transaction.amount > 0 ? 'transfer' : 'debit_card';
        case 'investment':
            return 'web_payment';
        default:
            return 'cash';
    }
}

function getMostSimilarRecords(walletRecordsFuseSearch: any, transaction: any) {
    return walletRecordsFuseSearch.search(transaction.memo);
}

function getCategory(transaction: any, categories: any, walletRecordsFuseSearch: any): Category {
    const mostSimilarRecordWithCategory = getMostSimilarRecords(
        walletRecordsFuseSearch,
        transaction
    ).find((record: any) => record.categoryId);
    if (transaction.transferId) {
        return categories.find((category: any) => category.name.toLowerCase() === 'transfer').id;
    }

    if (mostSimilarRecordWithCategory) {
        return mostSimilarRecordWithCategory.categoryId;
    }

    return categories.find((category: any) => category.name.toLowerCase() === 'others');
}

function convertToTransactions(
        transactions: OfxTransaction[], 
        accounts: Account[], categories: Category[],
        currencies: Currency[],
        walletRecordsFuseSearch: any): Transaction[] {
    return transactions.map((tr: OfxTransaction) => {
        const account = accounts.find((acc: any) => acc.name === tr.account.name);
        const transaction = {
            currency: currencies.find((curr: any) => curr.code === tr.currency),
            account: account,
            category: getCategory(tr, categories, walletRecordsFuseSearch),
            amount: tr.amount,
            paymentType: getPaymentType(tr),
            description: tr.memo,
            date: tr.date,
            state: 'cleared'
        } as Transaction
        if (transaction.transferId) {
            transaction.transferId = transaction.transferId;
        }

        return transaction;
    });
}

function detectTransfers(transactions: any, walletRecordsFuseSearch: any) {
    for (let x = 0; x < transactions.length; x++) {
        const t1 = transactions[x];
        if (t1.transferId) {
            continue;
        }

        for (let y = x + 1; y < transactions.length; y++) {
            const t2 = transactions[y];
            if (t1.date.diff(t2.date) > 5) {
                break;
            }

            if (!t2.transferId && (t1.amount + t2.amount) === 0 && t1.id.account !== t2.id.account) {
                const mostSimilarRecord1 = getMostSimilarRecords(walletRecordsFuseSearch, t1)[0];
                const mostSimilarRecord2 = getMostSimilarRecords(walletRecordsFuseSearch, t2)[0];
                if (mostSimilarRecord1 && mostSimilarRecord1.paymentType === 'transfer' &&
                    mostSimilarRecord2 && mostSimilarRecord2.paymentType === 'transfer') {
                    const transferId = uuidv4();

                    t1.transferId = transferId;
                    t1.transfer = t2;

                    t2.transferId = transferId;
                }
            }
        }
    }
}

function getFuseSearch(records: any, keys: any) {
    var options = {
        shouldSort: true,
        threshold: 0.7,
        location: 0,
        distance: 100,
        maxPatternLength: 500,
        minMatchCharLength: 1,
        keys: keys
    };
    return new Fuse(records, options);
}
