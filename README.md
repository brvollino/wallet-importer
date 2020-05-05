# wallet-importer
> Import OFX transaction files to your banking accounts on Wallet (budgetbakers.com).
- The records' categories will be guessed from the notes and categories of records preexisting in your Wallet.
- Transfers between your accounts will be inferred based on the OFX account IDs and notes of record  preexisting in your Wallet.
- All records will be imported with a 'cleared' Payment Status. I suggest you to change all your Wallet record status to 'Reconciled' before you use the importer, so you can track which records were imported.

## Installation

```sh
$ npm install -g
```

## Usage

```sh
# This will only test importing and not send transactions to Wallet. It will create a 'wallet_records.json' file so you can check the records that would be created
wallet-importer import-files --config example-config.json --dry-run
```

```sh
# To effectively send transactions to wallet. It still creates the 'wallet_records.json' file for logging purposes.
wallet-importer import-files --config example-config.json
```

Check the configuration options in the file "example-config.json".