'use strict';

import got, { Got } from 'got';
import moment from 'moment';
import { Account, Category, Currency, FinancesManagerService, Transaction, TransactionType } from '../finances-manager-service';
import { type } from 'os';
import { ApiAuth } from '../cli/import-file-config';
import logger from '../logger';

/**
 * Service that interacts with the Firefly-III finances manager using its REST API.
 * I only mapped parameters and response fields needed in my application, there may be much more features in the REST service.
 */
export class Firefly3Service implements FinancesManagerService {
    readonly baseUrl = 'http://localhost:9595/api';

    /**
     * TODO: Collect all the paginated results. The default page size is 50,
     * which is enough in my case.
     * https://api-docs.firefly-iii.org/#/accounts/listAccount
     **/
    async getAccounts(apiAuth: ApiAuth): Promise<Account[]> {
        const body = (await this.get(this.baseUrl + '/v1/accounts', apiAuth)).body
        const response = body as PagedResponse<Firefly3Account>
        
        return response.data.map((item) => {
            return {
                id: item.id.toString(),
                name: item.attributes.name,
                type: item.attributes.type
            } as Account
        })
    }

    /**
     * TODO: Collect all the paginated results. The default page size is 50.
     * https://api-docs.firefly-iii.org/#/categories/listCategory
     */
    async getCategories(apiAuth: ApiAuth): Promise<Category[]> {
        const body = (await this.get(this.baseUrl + '/v1/categories', apiAuth)).body
        const response = body as PagedResponse<Firefly3Category>

        return response.data.map((item) => {
            return {
                id: item.id.toString(),
                name: item.attributes.name
            } as Category
        })
    }

    /**
     * TODO: Collect all the paginated results. The default page size is 50.
     * https://api-docs.firefly-iii.org/#/currencies/listCurrency
     */
    async getCurrencies(apiAuth: ApiAuth): Promise<Currency[]> {
        const body = (await this.get(this.baseUrl + '/v1/currencies', apiAuth)).body
        const response = body as PagedResponse<Firefly3Currency>

        return response.data.map((item) => {
            return {
                id: item.id.toString(),
                code: item.attributes.code
            } as Currency
        })
    }

    /**
     * TODO: Collect all the paginated results. The default page size is 50.
     * https://api-docs.firefly-iii.org/#/transactions/listTransaction
     */
    async getAllTransactions(apiAuth: ApiAuth): Promise<Transaction[]> {
        const items: FireflyResource<Firefly3Transaction>[] = 
            await this.geAllPaginated(this.baseUrl + '/v1/transactions', apiAuth)

        return items.map((item) => {
            return {
                id: item.id,
                currency: {
                    id: item.attributes.transactions[0].currency_id?.toString(),
                    code: item.attributes.transactions[0].currency_code
                },
                sourceAccount: {
                    id: item.attributes.transactions[0].source_id?.toString(),
                    name: item.attributes.transactions[0].source_name,
                    type: item.attributes.transactions[0].source_type
                },
                destinationAccount: {
                    id: item.attributes.transactions[0].destination_id?.toString(),
                    name: item.attributes.transactions[0].destination_name,
                    type: item.attributes.transactions[0].destination_type
                },
                category: {
                    id: item.attributes.transactions[0].category_id?.toString(),
                    name: item.attributes.transactions[0].category_name,
                },
                amount: item.attributes.transactions[0].amount,
                description: item.attributes.transactions[0].description,
                date: moment(item.attributes.transactions[0].date),
                reconciled: item.attributes.transactions[0].reconciled,
                type: this.toTransactionType(item.attributes.transactions[0].type)
            } as Transaction
        })
    }

    async geAllPaginated<T>(url: string, apiAuth: ApiAuth): Promise<FireflyResource<T>[]> {
        let all: FireflyResource<T>[] = []
        let pagedResponse: PagedResponse<T>
        let page = 0
        do {
            const body = (await this.get(url, apiAuth, {page: page})).body
            pagedResponse = body as PagedResponse<T>
            all = all.concat(pagedResponse.data)
            page++
        } while(pagedResponse.meta.pagination.current_page < 
            pagedResponse.meta.pagination.total_pages)

        return all
    }

    /**
     * https://api-docs.firefly-iii.org/#/transactions/storeTransaction
     */
    async createRecords(apiAuth: ApiAuth, transactions: Transaction[]) {
        const fireflyTransactions = this.convertToFireflyTransactions(transactions)
        try {
            for(let tr of fireflyTransactions) {
                logger.info('Creating transaction.', tr)
                await got.post(this.baseUrl + '/v1/transactions', {
                    headers: {
                        'Authorization': 'Bearer ' + apiAuth.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(tr),
                    responseType: 'json'
                })
            }
        } catch (error) {
            logger.error('Error when creating firefly3 transactions.', { 
                code: error.code,
                statusCode: error.response.statusCode,
                body: error.response.body
            })
            throw error;
        }
    }

    private get(url: string, apiAuth: ApiAuth, 
            queryParams?: {[key: string]: string | number | boolean | null}) {
        return got(url, {
            headers: {
                'Authorization': 'Bearer ' + apiAuth.token
            },
            responseType: 'json',
            searchParams: queryParams
        })
    }

    private convertToFireflyTransactions(transactions: Transaction[]): Firefly3Transaction[] {
        return transactions.map((tr: Transaction) => {
            const ffTransaction: Firefly3Transaction = {
                error_if_duplicate_hash: false,
                apply_rules: false,
                transactions: [
                    {
                        type: this.fromTransactionType(tr.type),
                        date: tr.date.toISOString(),
                        amount: tr.amount,
                        description: tr.description || 'No description',
                        currency_id: parseInt(tr.currency.id),
                        category_name: tr.category.name,
                        reconciled: tr.reconciled,
                        tags: tr.tags
                    }
                ]
            } as Firefly3Transaction
            if (tr.sourceAccount) {
                ffTransaction.transactions[0].source_id = parseInt(tr.sourceAccount.id)
            }
            if (tr.destinationAccount) {
                ffTransaction.transactions[0].destination_id = parseInt(tr.destinationAccount.id)
            }
            
            return ffTransaction
        })
    }

    private toTransactionType(fireflyType: string | undefined): TransactionType {
        switch(fireflyType) {
            case "withdrawal": return TransactionType.WITHDRAWAL
            case "deposit": return TransactionType.DEPOSIT
            case "transfer": return TransactionType.TRANSFER
            case "reconciliation": 
            default:
                return TransactionType.OTHER
        }
    }

    private fromTransactionType(transactionType: TransactionType): string | undefined {
        switch(transactionType) {
            case TransactionType.WITHDRAWAL: return "withdrawal"
            case TransactionType.DEPOSIT: return "deposit"
            case TransactionType.TRANSFER: return "transfer"
            case TransactionType.OTHER: 
            default:
                return undefined
        }
    }
}

interface FireflyResource<T> {
    id: number
    type: string
    attributes: T
}

interface Firefly3Account{
    name: string
    type: string // e.g. "asset"
    currency_id: string
    currency_code: string // e.g. "EUR"
    notes: string
}

interface Firefly3Category{
    name: string
}

interface Firefly3Currency{
    code: string
}

interface Firefly3Transaction {    
    readonly created_at: string // e.g. "2018-09-17T12:46:47+01:00"
    readonly updated_at: string
    readonly user: number
    error_if_duplicate_hash?: boolean
    apply_rules?: boolean
    group_title?: string
    transactions: [
        {
            readonly user: number
            readonly transaction_journal_id: number
            type?: string, //"withdrawal" | "deposit" | "transfer" | "reconciliation" 
            date: string // e.g. "2018-09-17"
            amount: number
            description: string
            order?: string
            currency_id? : number
            currency_code? : string
            category_id? : number
            category_name? : string
            source_id?: number // source account (for transfers)
            source_name? : string
            readonly source_type: string // e.g. "Asset account"
            destination_id?: number  // destination account (for transfers)
            destination_name?: string
            readonly destination_type: string
            reconciled?: boolean
            notes?: string[],
            tags?: string[]
        }
    ]
}

interface PagedResponse<T> {
    data: FireflyResource<T>[]
    meta: {
        pagination: {
            total: number
            count: number
            per_page: number
            current_page: number
            total_pages: number
        }
    }
}