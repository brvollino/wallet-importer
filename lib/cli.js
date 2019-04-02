#!/usr/bin/env node
'use strict';
const OfxImporter = require('./ofx-importer.js');
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

require('yargs')
    .usage('Usage: $0 <command> [options]')
    .command(
        'import-files',
        'Import transaction files to accounts',
        function(yargs) {
            yargs.example('$0 import-files --config <file>')
                .config('config',
                    `Path for JSON config file containing this structure:
                    {
                        "apiToken": <apiToken>,
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
        function(argv) {
            new OfxImporter(logger).import(argv.apiAuth, argv.maxDate, argv['dry-run'], argv.files);
        }
    )
    .help('h').alias('h', 'help');
