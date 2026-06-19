export interface RawCsvRow {
  rowIndex: number;
  cells: Record<string, string>;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  account?: string;
  bankType?: string;
}

export interface ValidationError {
  rowIndex: number;
  column: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface NormalizedRow {
  rowIndex: number;
  date: string;
  description: string;
  amount: number;
  rawAmount: string;
  account: string;
  bankType: string;
  isDuplicate: boolean;
  duplicateOf?: number;
  skip?: boolean;
  type?: string;
  category?: string;
}

export interface ImportPreview {
  rows: NormalizedRow[];
  validationErrors: ValidationError[];
  sourceFile: string;
  totalRows: number;
}

export interface ImportConfirmation {
  sessionId: string;
  skippedRowIndices: number[];
}
