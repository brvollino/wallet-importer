import { Moment } from "moment";
import { ApiAuth } from "./cli/import-file-config";

export interface FinancesManagerService {
    getAccounts(apiAuth: ApiAuth): Promise<Account[]>
    getCategories(apiAuth: ApiAuth): Promise<Category[]>
    getCurrencies(apiAuth: ApiAuth): Promise<Currency[]>
    getAllTransactions(apiAuth: ApiAuth): Promise<Transaction[]>
    createRecords(apiAuth: ApiAuth, transactions: Transaction[]): any
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

export enum TransactionType {
    WITHDRAWAL = 'withdrawal',
    DEPOSIT = 'deposit',
    TRANSFER = 'transfer',
    OTHER = 'othe'
}

export interface Transaction {
    id: number,
    currency: Currency
    sourceAccount: Account,
    destinationAccount: Account,
    category: Category,
    amount: number,
    paymentType: string,
    description: string,
    date: Moment,
    state: string,
    transferId?: string,
    reconciled: boolean,
    type: TransactionType
}