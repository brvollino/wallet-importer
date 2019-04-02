'use strict';

const got = require('got');

class WalletService {
    async getWalletAccounts(apiAuth) {
        return (await got('https://api.budgetbakers.com/api/v1/accounts', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            json: true
        })).body;
    }

    async getWalletCategories(apiAuth) {
        return (await got('https://api.budgetbakers.com/api/v1/categories', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            json: true
        })).body;
    }

    async getWalletCurrencies(apiAuth) {
        return (await got('https://api.budgetbakers.com/api/v1/currencies', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            json: true
        })).body;
    }

    async getAllRecords(apiAuth) {
        return (await got('https://api.budgetbakers.com/api/v1/records', {
            headers: {
                'X-User': apiAuth.user,
                'X-Token': apiAuth.token
            },
            json: true
        })).body;
    }

    async sendRecordsToWallet(apiAuth, transactions) {
        try {
            return await got.post('https://api.budgetbakers.com/api/v1/records-bulk', {
                headers: {
                    'X-User': apiAuth.user,
                    'X-Token': apiAuth.token,
                    'Content-Type': 'application/json'
                },
                body: transactions,
                json: true
            });
        } catch (error) {
            console.log(error.response);
            throw error;
        }
    }
}

module.exports = new WalletService();
