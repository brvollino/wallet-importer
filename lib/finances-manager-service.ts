import { Moment } from "moment";

export interface FinancesManagerService {
    getAccounts(apiAuth: any): Promise<Account[]>
    getCategories(apiAuth: any): Promise<Category[]>
    getCurrencies(apiAuth: any): Promise<Currency[]>
    getAllTransactions(apiAuth: any): Promise<Transaction[]>
    writeRecords(apiAuth: any, transactions: Transaction[]): any
}

export interface Account {
    id: string
    name: string
    type: string
}

export interface Category {
    id: string
    name: string
}

export interface Currency {
    id: string
    code: string
}

export interface Transaction {
    currency: Currency
    account: Account,
    category: Category,
    amount: number,
    paymentType: string,
    description: string,
    date: Moment,
    state: string,
    transferId?: string
}