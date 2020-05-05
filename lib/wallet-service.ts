'use strict';

import got from 'got';

export class WalletService {
    async getWalletAccounts(apiAuth: any) {
        return (await got('https://api.budgetbakers.com/api/v1/accounts', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            responseType: 'json'
        })).body;
    }

    async getWalletCategories(apiAuth: any) {
        return (await got('https://api.budgetbakers.com/api/v1/categories', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            responseType: 'json'
        })).body;
    }

    async getWalletCurrencies(apiAuth: any) {
        return (await got('https://api.budgetbakers.com/api/v1/currencies', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            responseType: 'json'
        })).body;
    }

    async getAllRecords(apiAuth: any) {
        return (await got('https://api.budgetbakers.com/api/v1/records', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            responseType: 'json'
        })).body;
    }

    async sendRecordsToWallet(apiAuth: any, transactions: any) {
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
}
