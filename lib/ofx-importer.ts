'use strict';

import moment from 'moment';
import {OfxParser} from './ofx-parser'
import {WalletService} from './wallet-service';
import {v4 as uuidv4} from 'uuid';
const fs = require('fs');
import Fuse from 'fuse.js';

export class OfxImporter {
    constructor(private logger: any, private financesManagerService: WalletService) {
    }

    async import(apiAuth: any, maxDate: string, dryRun: boolean, files: any) {
        this.logger.info('Importing files: dryRun: %s, files: %o', dryRun, files);
        let transactions = await new OfxParser().parseOfxFiles(files);
        transactions = transactions.sort((t1: any, t2: any) => {
            return t1.date.diff(t2.date);
        });
        const max = moment(maxDate).endOf('day');
        transactions = transactions.filter((tr: any) => tr.date.isSameOrBefore(max));

        const walletAccounts = await this.financesManagerService.getWalletAccounts(apiAuth);
        const walletCurrencies = await this.financesManagerService.getWalletCurrencies(apiAuth);
        const walletCategories = await this.financesManagerService.getWalletCategories(apiAuth);
        this.logger.info({
            walletAccounts: walletAccounts,
            walletCategories: walletCategories,
            walletCurrencies: walletCurrencies
        });

        const allWalletRecords = await this.financesManagerService.getAllRecords(apiAuth);
        const walletRecordsFuseSearch = getFuseSearch(allWalletRecords, ['note']);

        detectTransfers(transactions, walletRecordsFuseSearch);

        fs.writeFile('transactions.json', JSON.stringify(transactions, null, 2));

        const walletRecords = convertToWalletRecords(
            transactions,
            walletAccounts,
            walletCategories,
            walletCurrencies,
            walletRecordsFuseSearch
        );

        fs.writeFile('wallet_records.json', JSON.stringify(walletRecords, null, 2));

        if (!dryRun) {
            this.financesManagerService.sendRecordsToWallet(apiAuth, walletRecords);
        }
    }
}

function getPaymentType(transaction: any) {
    switch (transaction.walletAccount.type) {
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

function getCategory(transaction: any, walletCategories: any, walletRecordsFuseSearch: any) {
    const mostSimilarRecordWithCategory = getMostSimilarRecords(
        walletRecordsFuseSearch,
        transaction
    ).find((record: any) => record.categoryId);
    if (transaction.transferId) {
        return walletCategories.find((category: any) => category.name === 'Transfer').id;
    }

    if (mostSimilarRecordWithCategory) {
        return mostSimilarRecordWithCategory.categoryId;
    }

    return walletCategories.find((category: any) => category.name === 'Others').id;
}

function convertToWalletRecords(
    transactions: any, walletAccounts: any, walletCategories: any, walletCurrencies: any, walletRecordsFuseSearch: any) {
    return transactions.map((tr: any) => {
        const account = walletAccounts.find((acc: any) => acc.name === tr.walletAccount.name);
        const record = {
            currencyId: walletCurrencies.find((curr: any) => curr.code === tr.currency).id,
            accountId: account.id,
            categoryId: getCategory(tr, walletCategories, walletRecordsFuseSearch),
            amount: tr.amount,
            paymentType: getPaymentType(tr),
            note: tr.memo,
            date: tr.date.toISOString(),
            recordState: 'cleared'
        } as WalletRecord;
        if (tr.transferId) {
            record.transferId = tr.transferId;
        }

        return record;
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
