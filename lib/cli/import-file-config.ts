export interface ImportConfig {
    apiAuth: ApiAuth
    maxDate: string
    destination: 'wallet' | 'firefly3'
    files: ImportFileConfig[]
}

export interface ApiAuth {
    user: string
    token: string
}

export interface ImportFileConfig {
    path: string
    format: 'ofx' | 'wallet',
    account: AccountConfig
}

export interface AccountConfig {
    name: string,
    type: string
}
