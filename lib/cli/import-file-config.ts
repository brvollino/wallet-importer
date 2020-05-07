export interface ImportFileConfig {
    path: string
    type: 'ofx',
    account: AccountConfig
}

export interface AccountConfig {
    name: string,
    type: string
}