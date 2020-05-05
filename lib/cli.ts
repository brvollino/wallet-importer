#!/usr/bin/env node
'use strict';

import {OfxImporter} from './ofx-importer.js'
import {WalletService} from './wallet-service.js'
import yargs = require('yargs')

const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.colorize(), winston.format.json()),
    prettyPrint: true,
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.splat(),
                winston.format.simple(),
                winston.format.timestamp(),
                winston.format.prettyPrint()
            )
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
            new OfxImporter(logger, new WalletService()).import(argv.apiAuth, argv.maxDate, argv['dry-run'], argv.files);
        }
    )
    .help('h').alias('h', 'help')
    .argv;
