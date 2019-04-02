'use strict';

const moment = require('moment');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const WalletService = require('./wallet-service');
const OfxParser = require('./ofx-parser');
const Fuse = require('fuse.js');

function getPaymentType(transaction) {
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

function getMostSimilarRecords(walletRecordsFuseSearch, transaction) {
    return walletRecordsFuseSearch.search(transaction.memo);
}

function getCategory(transaction, walletCategories, walletRecordsFuseSearch) {
    const mostSimilarRecordWithCategory = getMostSimilarRecords(
        walletRecordsFuseSearch,
        transaction
    ).find(record => record.categoryId);
    if (transaction.transferId) {
        return walletCategories.find(category => category.name === 'Transfer').id;
    }

    if (mostSimilarRecordWithCategory) {
        return mostSimilarRecordWithCategory.categoryId;
    }

    return walletCategories.find(category => category.name === 'Others').id;
}

function convertToWalletRecords(
    transactions, walletAccounts, walletCategories, walletCurrencies, walletRecordsFuseSearch) {
    return transactions.map(tr => {
        const account = walletAccounts.find(acc => acc.name === tr.walletAccount.name);
        const record = {
            currencyId: walletCurrencies.find(curr => curr.code === tr.currency).id,
            accountId: account.id,
            categoryId: getCategory(tr, walletCategories, walletRecordsFuseSearch),
            amount: tr.amount,
            paymentType: getPaymentType(tr),
            note: tr.memo,
            date: tr.date.toISOString(),
            recordState: 'cleared'
        };
        if (tr.transferId) {
            record.transferId = tr.transferId;
        }

        return record;
    });
}

function detectTransfers(transactions, walletRecordsFuseSearch) {
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

function getFuseSearch(records, keys) {
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

class OfxImporter {
    constructor(logger) {
        this.logger = logger;
    }

    async import(apiAuth, maxDate, dryRun, files) {
        this.logger.info('Importing files: dryRun: %s, files: %o', dryRun, files);
        let transactions = await OfxParser.parseOfxFiles(files);
        transactions = transactions.sort(function(t1, t2) {
            return t1.date.diff(t2.date);
        });
        const max = moment(maxDate).endOf('day');
        transactions = transactions.filter(tr => tr.date.isSameOrBefore(max));

        const walletAccounts = await WalletService.getWalletAccounts(apiAuth);
        const walletCurrencies = await WalletService.getWalletCurrencies(apiAuth);
        const walletCategories = await WalletService.getWalletCategories(apiAuth);
        this.logger.info({
            walletAccounts: walletAccounts,
            walletCategories: walletCategories,
            walletCurrencies: walletCurrencies
        });

        const allWalletRecords = await WalletService.getAllRecords(apiAuth);
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
            WalletService.sendRecordsToWallet(apiAuth, walletRecords);
        }
    }
}

module.exports = OfxImporter;
