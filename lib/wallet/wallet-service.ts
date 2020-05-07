'use strict';

import got from 'got';
import moment from 'moment';
import { Account, Category, Currency, FinancesManagerService, Transaction } from '../finances-manager-service';

export class WalletService implements FinancesManagerService {
    async getAccounts(apiAuth: any): Promise<Account[]> {
        const body = (await this.get('https://api.budgetbakers.com/api/v1/accounts', apiAuth)).body

        return body as Account[]
    }

    async getCategories(apiAuth: any): Promise<Category[]> {
        const body = (await this.get('https://api.budgetbakers.com/api/v1/categories', apiAuth)).body

        return body as Category[]
    }

    async getCurrencies(apiAuth: any): Promise<Currency[]> {
        const body = (await this.get('https://api.budgetbakers.com/api/v1/currencies', apiAuth)).body

        return body as Currency[]
    }

    async getAllTransactions(apiAuth: any): Promise<Transaction[]> {
        const body = (await this.get('https://api.budgetbakers.com/api/v1/records', apiAuth)).body
        const records = body as WalletRecord[]

        return records.map((rec: WalletRecord) => {
            return {
                currency: {
                    id: rec.currencyId
                },
                account: {
                    id: rec.accountId
                },
                category: {
                    id: rec.categoryId
                },
                amount: rec.amount,
                paymentType: rec.paymentType,
                description: rec.note,
                date: moment(rec.date),
                state: rec.recordState,
                transferId: rec.transferId
            }
        }) as Transaction[]
    }

    async writeRecords(apiAuth: any, transactions: Transaction[]) {
        const walletRecords = this.convertToWalletRecords(transactions)
        try {
            return await got.post('https://api.budgetbakers.com/api/v1/records-bulk', {
                headers: {
                    'X-User': apiAuth.user,
                    'X-Token': apiAuth.token,
                    'Content-Type': 'application/json'
                },
                json: transactions,
                responseType: 'json'
            });
        } catch (error) {
            console.log(error.response);
            throw error;
        }
    }

    private get(url: string, apiAuth: any) {
        return got(url, {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            responseType: 'json'
        })
    }

    private convertToWalletRecords(transactions: Transaction[]): WalletRecord[] {
    return transactions.map((tr: Transaction) => {
        const record = {
            currencyId: tr.currency.id,
            accountId: tr.account.id,
            categoryId: tr.category.id,
            amount: tr.amount,
            paymentType: tr.paymentType,
            note: tr.description,
            date: tr.date.toISOString(),
            recordState: 'cleared',
            transferId: tr.transferId
        } as WalletRecord;

        return record;
    });
}
}
