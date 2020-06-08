#!/usr/bin/env node
'use strict';

import { ImportConfig } from './cli/import-file-config.js';
import { FinancesManagerService } from './finances-manager-service.js';
import { FinancialTransactionsImporter } from './financial-transactions-importer.js';
import { Firefly3Service } from './firefly-3/firefly-3-service.js';
import { WalletService } from './wallet/wallet-service';
import yargs = require('yargs')

yargs
    .usage('Usage: $0 <command> [options]')
    .command(
        'import-files',
        'Import transaction files to accounts',
        (yargs: any) => {
            yargs.example('$0 import-files --config <file>')
                .config('config',
                    `Path for JSON config file containing this structure:
                    {
                        "apiAuth": {
                            "user": "<apiUser>",
                            "token": "<apiToken>"
                        },
                        "destination": "wallet" | "firefly3"
                        "maxDate": "2019-04-30",
                        "files": [
                            {
                                "path": <filePath>,
                                "format": "ofx" | "wallet",
                                "account": <destinationAccount>
                            }
                        ]
                    }
                    `)
                .demand('config')
                .describe('dry-run', "Don't send any operations, only output to the console")
                .boolean('dry-run');
        },
        (argv: any) => {
            const importConfig = argv as ImportConfig
            let financesManagerService: FinancesManagerService
            switch(importConfig.destination) {
                case 'wallet': financesManagerService = new WalletService()
                    break
                case 'firefly3': financesManagerService = new Firefly3Service()
                    break
                default: console.error('Invalid destination "%s"', importConfig.destination)
                    return
            }
            new FinancialTransactionsImporter(financesManagerService)
                .import(importConfig.apiAuth, importConfig.maxDate, argv['dry-run'], importConfig.files);
        }
    )
    .help('h').alias('h', 'help')
    .argv;
