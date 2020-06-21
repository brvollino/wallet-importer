'use strict';

import Fuse from 'fuse.js'
import moment from 'moment'
import { v4 as uuidv4 } from 'uuid'
import { ImportFileConfig, ApiAuth } from './cli/import-file-config'
import { FileLoader } from './file-loader'
import { Account, Category, Currency, FinancesManagerService, Transaction, TransactionType } from './finances-manager-service'
import { OfxTransaction, OfxFileLoader } from './ofx/ofx-file-loader'
import { WalletExportedFileLoader } from './wallet/wallet-exported-file-loader'
import fs from 'fs'
import logger from './logger'

export class FinancialTransactionsImporter {
    constructor(private financesService: FinancesManagerService) { }

    private getFileLoader(file: ImportFileConfig): FileLoader {
        switch(file.format) {
            case 'ofx': return new OfxFileLoader()
                break
            case 'wallet': return new WalletExportedFileLoader()
            default:
                const error = `Unknown file format "${file.format}"`
                logger.error(error)
                throw error
        }
    }

    async import(apiAuth: ApiAuth, maxDate: string, dryRun: boolean, files: ImportFileConfig[]) {
        logger.info('Importing files: dryRun: %s, files: %o', dryRun, files);
        let transactions: OfxTransaction[] = []

        for (let file of files) {
            logger.info('Parsing file: %o', file);
            const fileLoader = this.getFileLoader(file)
            transactions = transactions.concat(await fileLoader.loadTransactions([file]))
        }

        transactions = transactions.sort((t1: OfxTransaction, t2: OfxTransaction) => {
            return t1.date.diff(t2.date)
        })
        const max = moment(maxDate).endOf('day');
        transactions = transactions.filter((tr: OfxTransaction) => 
            tr.date.isSameOrBefore(max) || tr.account.type === 'credit_card')
        
        logger.info('Getting accounts')
        const accounts = await this.financesService.getAccounts(apiAuth);
        logger.info('Getting currencies')
        const currencies = await this.financesService.getCurrencies(apiAuth);
        logger.info('Getting categories')
        const categories = await this.financesService.getCategories(apiAuth);
        logger.info({
            accounts: accounts,
            categories: categories,
            currencies: currencies
        });

        logger.info('Getting all transactions from service')
        const allRecords: Transaction[] = await this.financesService.getAllTransactions(apiAuth);
        const transactionsFuseSearch: Fuse<Transaction, any> = getFuseSearch(allRecords, ['description']);

        logger.info('Writing parsed transactions file')
        fs.writeFile('parsed_transactions.json', JSON.stringify(transactions, null, 2), _ => {})

        logger.info('Converting to transactions')
        let loadedTransactions: Transaction[] = convertToTransactions(
            transactions,
            accounts,
            currencies);

        logger.info('Detecting transfers')
        loadedTransactions = detectTransfers(loadedTransactions, transactionsFuseSearch)

        logger.info('Setting categories')
        loadedTransactions.forEach(tr => {
            if (!tr.category) {
                tr.category = getCategory(tr, categories, transactionsFuseSearch)
            }
        })

        logger.info('Writing transactions file')
        fs.writeFile('transactions.json', JSON.stringify(loadedTransactions, null, 2), _ => {})

        if (!dryRun) {
            logger.info('Creating transactions in the service')
            await this.financesService.createRecords(apiAuth, loadedTransactions);
        }
    }
}

function getPaymentType(transaction: OfxTransaction) {
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

function getMostSimilarRecords(transactionsFuseSearch: Fuse<Transaction, any>, 
        transaction: Transaction): Transaction[] {
    return transactionsFuseSearch.search(transaction.description).map(result => result.item)
}

function getCategory(transaction: Transaction, categories: Category[], 
        transactionsFuseSearch: Fuse<Transaction, any>): Category {
    const mostSimilarRecordWithCategory = getMostSimilarRecords(transactionsFuseSearch, transaction)
        .find((tr: Transaction) => tr.category);
    let category: Category | undefined
    if (transaction.category) {
        category = categories.find((category: Category) => 
            category.name.toLowerCase() === transaction.category.name?.toLocaleLowerCase())
            || transaction.category
    } else if (transaction.transferId) {
        category = categories.find((category: Category) => category.name.toLowerCase() === 'transfer') 
            || {name: 'Transfer'} as Category
    } else if (mostSimilarRecordWithCategory) {
        category = mostSimilarRecordWithCategory.category;
    } else {
        category = categories.find((category: any) => category.name.toLowerCase() === 'others')
    }

    return category || {name: 'Others'} as Category
}

function convertToTransactions(
        transactions: OfxTransaction[], 
        accounts: Account[], 
        currencies: Currency[]): Transaction[] {
    return transactions.map((ofxTr: OfxTransaction) => {
        const account = accounts.find((acc: any) => acc.name === ofxTr.account.name)
        let sourceAccount: Account | undefined
        let destinationAccount: Account | undefined
        if (ofxTr.amount > 0) {
            destinationAccount = account
        } else {
            sourceAccount = account
        }
        const transaction = {
            currency: currencies.find((curr: any) => curr.code === ofxTr.currency),
            sourceAccount: sourceAccount,
            destinationAccount: destinationAccount,
            amount: Math.abs(ofxTr.amount),
            paymentType: getPaymentType(ofxTr),
            description: ofxTr.memo,
            date: ofxTr.date,
            state: 'cleared',
            reconciled: false,
            type: getTransactionType(ofxTr),
            tags: ['Imported', 'Unverified', ofxTr.filename]
        } as Transaction
        if (ofxTr.category) {
            transaction.category = {name: ofxTr.category} as Category
        }

        return transaction;
    });
}

function getTransactionType(ofxTr: OfxTransaction): TransactionType {
    let type: TransactionType
    if (ofxTr.amount > 0) {
        type = TransactionType.DEPOSIT
    } else if (ofxTr.amount < 0) {
        type = TransactionType.WITHDRAWAL
    } else {
        type = TransactionType.OTHER
    }
    return type
}

function createTransferRecord(t1: Transaction, t2: Transaction): Transaction {
    const transferTransaction = JSON.parse(JSON.stringify(t1)) as Transaction
    transferTransaction.type = TransactionType.TRANSFER
    transferTransaction.amount = Math.abs(t1.amount)
    transferTransaction.description = t1.description.trim()
    if (t2.description.trim() !== transferTransaction.description) {
        transferTransaction.description += "\n" + t2.description.trim()
    }
    transferTransaction.description = transferTransaction.description.trim()
    transferTransaction.date = moment(t1.date)

    return transferTransaction
}

// Pre-requisites: transactions are ordered by date
function detectTransfers(transactions: Transaction[], transacionsFuseSearch: Fuse<Transaction, any>): Transaction[] {
    const transactionsWithTransfers: Transaction[] = []
    for (let x = 0; x < transactions.length; x++) {
        const t1 = transactions[x];
        if (t1.transferId) {
            continue;
        }

        for (let y = x + 1; y < transactions.length; y++) {
            const t2 = transactions[y];
            if (t1.date.diff(t2.date, "days") > 5) {
                break;
            }
            if (!t2.transferId
                && (t1.type === TransactionType.WITHDRAWAL || t1.type === TransactionType.DEPOSIT)
                && (t2.type === TransactionType.WITHDRAWAL || t2.type === TransactionType.DEPOSIT)
                && (t1.type != t2.type)
                && ((t1.amount - t2.amount) === 0)
                && (!(t1.sourceAccount || t2.destinationAccount) || !(t1.destinationAccount || t2.sourceAccount))
                && ((t1.sourceAccount !== t2.destinationAccount) || (t1.destinationAccount !== t2.sourceAccount))
            ) {
                const mostSimilarRecord1 = getMostSimilarRecords(transacionsFuseSearch, t1)[0];
                const mostSimilarRecord2 = getMostSimilarRecords(transacionsFuseSearch, t2)[0];
                if ((isTransfer(t1) && isTransfer(t2))
                    || (isTransfer(mostSimilarRecord1) && isTransfer(mostSimilarRecord2))) {
                    const transferId = uuidv4()
                    t1.transferId = transferId
                    t2.transferId = transferId
                    if (!t1.sourceAccount) {
                        t1.sourceAccount = t2.sourceAccount
                        t2.destinationAccount = t1.destinationAccount
                    } else {
                        t1.destinationAccount = t2.destinationAccount
                        t2.sourceAccount = t1.sourceAccount
                    }
                    transactionsWithTransfers.push(createTransferRecord(t1, t2))
                    break
                }
            }
        }
        if (!t1.transferId) {
            transactionsWithTransfers.push(t1)
        }
    }
    return transactionsWithTransfers
}

function isTransfer(transaction: Transaction): boolean {
    return transaction?.paymentType?.toLowerCase() === 'transfer' 
        || transaction?.category?.name?.toLowerCase() === 'transfer'
        || transaction?.type === TransactionType.TRANSFER
}

function getFuseSearch(records: Transaction[], keys: any): Fuse<Transaction, any> {
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
