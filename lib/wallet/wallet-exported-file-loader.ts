import { FileLoader } from "../file-loader";
import { ImportFileConfig, AccountConfig } from "../cli/import-file-config";
import { OfxTransaction, OfxBankAccount } from "../ofx/ofx-file-loader";
import parse from "csv-parse/lib/sync"
import fs from 'fs'
import moment from 'moment'

interface Record {
    account: string
    category: string
    currency: string
    amount: string
    type: string
    payment_type: string
    note: string,
    transfer: boolean,
    date: string
}

export class WalletExportedFileLoader implements FileLoader {
    async loadTransactions(files: ImportFileConfig[]): Promise<OfxTransaction[]> {
        let id = 1
        return files.map(file => {
            const buffer = fs.readFileSync(file.path)
            return parse(buffer, {
                delimiter: ';',
                columns: true,
                skip_empty_lines: true,
                from_line: 1
            })
            .map((record: Record) => {
                return {
                    account: {
                        name: record.account    
                    } as AccountConfig,
                    id: {
                        fitId: '' + id++,
                        checkNum: '',
                        refNum: '',
                        account: {
                            accountId: record.account
                        } as OfxBankAccount
                    },
                    date: moment(record.date),
                    amount: Number.parseFloat(record.amount),
                    currency: record.currency,
                    memo: record.note,
                    category: record.category
                } as OfxTransaction
            })
        }).flat()
    }
}