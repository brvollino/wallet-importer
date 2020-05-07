import { ImportFileConfig } from "./cli/import-file-config";
import { OfxTransaction } from "./ofx/ofx-file-loader";

export interface FileLoader {
    loadTransactions(files: ImportFileConfig[]): Promise<OfxTransaction[]>
}