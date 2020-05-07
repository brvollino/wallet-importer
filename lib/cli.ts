#!/usr/bin/env node
'use strict';

import * as winston from 'winston';
import { ImportFileConfig } from './cli/import-file-config.js';
import { FinancialTransactionsImporter } from './financial-transactions-importer.js';
import { OfxFileLoader } from './ofx/ofx-file-loader.js';
import { WalletService } from './wallet/wallet-service';
import yargs = require('yargs')


const logger: winston.Logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(), 
        winston.format.json(), 
        winston.format.prettyPrint()),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console(
        {
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.splat(),
                winston.format.simple(),
                winston.format.timestamp(),
                winston.format.prettyPrint())
        })
    );
}


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
                            "user": "<walletUser>",
                            "token": "<apiToken>"
                        },
                        "maxDate": "2019-04-30",
                        "files": [
                            {
                                "path": <filePath>,
                                "format": "ofx",
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
            new FinancialTransactionsImporter(logger, new OfxFileLoader(), new WalletService())
                .import(argv.apiAuth, argv.maxDate, argv['dry-run'], argv.files as ImportFileConfig[]);
        }
    )
    .help('h').alias('h', 'help')
    .argv;
