'use strict';

import moment, { Moment } from 'moment';
import { AccountConfig, ImportFileConfig } from '../cli/import-file-config';
import { FileLoader } from '../file-loader';
const Banking = require('banking');

export interface OfxTransaction {
    account: AccountConfig,
    id: {
        fitId: string,
        checkNum: string,
        refNum: string,
        account: OfxBankAccount
    },
    type: string,
    date: Moment,
    amount: number,
    currency: string,
    memo: string
}

export interface OfxBankAccount {
    bankId: string
    branchId: string
    accountId: string
    accountType: string
}

export class OfxFileLoader implements FileLoader {
    async loadTransactions(files: ImportFileConfig[]): Promise<OfxTransaction[]> {
        const promises = files.map((file: ImportFileConfig) => {
            return parseOfxFile(file);
        });
        var transactionLists = await Promise.all(promises);
        return flat(transactionLists);
    }
}

function convertListOfOfxTransactions(account: AccountConfig, ofxBankAccount: any, 
        parsedTransactions: OfxTransaction[], currency: string): OfxTransaction[] {
    if (!parsedTransactions) {
        return [];
    }

    if (!Array.isArray(parsedTransactions)) {
        parsedTransactions = [parsedTransactions];
    }

    return parsedTransactions.map((transaction: any) => {
        return {
            account: account,
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
        } as OfxTransaction;
    });
}

function convertAllOfxTransactions(account: AccountConfig, parsedFile: any): OfxTransaction[] {
    let transactions: any[] = [];
    const ofxBody = parsedFile.body.OFX;
    if (ofxBody.CREDITCARDMSGSRSV1) {
        const ofxBankAccount = ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.CCACCTFROM;
        const ofxTransactions =
            ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.BANKTRANLIST.STMTTRN;
        const currency = ofxBody.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.CURDEF;
        transactions = transactions.concat(
            convertListOfOfxTransactions(account, ofxBankAccount, ofxTransactions, currency));
    }

    if (ofxBody.BANKMSGSRSV1) {
        const ofxBankAccount = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKACCTFROM;
        const ofxTransactions = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
        const currency = ofxBody.BANKMSGSRSV1.STMTTRNRS.STMTRS.CURDEF;
        transactions = transactions.concat(
            convertListOfOfxTransactions(account, ofxBankAccount, ofxTransactions, currency));
    }

    return transactions;
}

function parseOfxFile(file: ImportFileConfig): Promise<OfxTransaction[]> {
    const promise = new Promise<OfxTransaction[]>(function(resolve) {
        Banking.parseFile(file.path, function(parsedFile: any) {
            console.log('Converting ' + file.path);
            const oneFileTransactions = convertAllOfxTransactions(file.account, parsedFile);
            console.log('Converted ' + file.path);
            resolve(oneFileTransactions);
        });
    });

    return promise;
}

function flat(nestedList: any): OfxTransaction[] {
    return nestedList.reduce((acc: any, value: any) => acc.concat(value));
}
