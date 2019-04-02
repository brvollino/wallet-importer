'use strict';

const Banking = require('banking');
const moment = require('moment');

function convertListOfOfxTransactions(walletAccount, ofxBankAccount, ofxTransactions, currency) {
    if (!ofxTransactions) {
        return [];
    }

    if (!Array.isArray(ofxTransactions)) {
        ofxTransactions = [ofxTransactions];
    }

    return ofxTransactions.map(transaction => {
        return {
            walletAccount: walletAccount,
            id: {
                fitId: transaction.FITID,
                checkNum: transaction.CHECKNUM,
                refNum: transaction.REFNUM,
                account: {
                    bankId: ofxBankAccount.BANKID,
                    branchId: ofxBankAccount.BRANCHID,
                    accountId: ofxBankAccount.ACCTID,
                    accountType: ofxBankAccount.ACCTTYPE
                }
            },
            type: transaction.TRNTYPE,
            date: moment(transaction.DTPOSTED, 'YYYYMMDDHHmmss'),
            amount: parseFloat(transaction.TRNAMT),
            currency: currency,
            memo: transaction.MEMO
        };
    });
}

function convertAllOfxTransactions(walletAccount, parsed) {
    let transactions = [];
    const ofxBody = parsed.body.OFX;
    if (ofxBody.CREDITCARDMSGSRSV1) {
        const ofxBankAccount = ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.CCACCTFROM;
        const ofxTransactions =
            ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.BANKTRANLIST.STMTTRN;
        const currency = ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.CURDEF;
        transactions = transactions.concat(
            convertListOfOfxTransactions(walletAccount, ofxBankAccount, ofxTransactions, currency));
    }

    if (ofxBody.BANKMSGSRSV1) {
        const ofxBankAccount = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM;
        const ofxTransactions = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const currency = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.CURDEF;
        transactions = transactions.concat(
            convertListOfOfxTransactions(walletAccount, ofxBankAccount, ofxTransactions, currency));
    }

    return transactions;
}

function parseOfxFile(file) {
    const promise = new Promise(function(resolve) {
        Banking.parseFile(file.path, function(parsed) {
            console.log('Converting ' + file.path);
            const oneFileTransactions = convertAllOfxTransactions(file.account, parsed);
            console.log('Converted ' + file.path);
            resolve(oneFileTransactions);
        });
    });

    return promise;
}

function flat(nestedList) {
    return nestedList.reduce((acc, value) => acc.concat(value));
}

class OfxParser {
    async parseOfxFiles(files) {
        const promises = files.map(file => {
            return parseOfxFile(file);
        });
        var transactionLists = await Promise.all(promises);
        return flat(transactionLists);
    }
}

module.exports = new OfxParser();
