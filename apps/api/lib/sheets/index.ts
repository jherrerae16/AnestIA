/**
 * SheetsExporter — exportación opcional a Google Sheets (bajo demanda, U6).
 * PostgreSQL sigue siendo la fuente de verdad; esto es downstream, nunca disparador.
 */
export interface SheetsExporter {
  export(caseIds: string[]): Promise<{ spreadsheetUrl: string | null }>;
}

class NoopSheetsExporter implements SheetsExporter {
  async export(_caseIds: string[]): Promise<{ spreadsheetUrl: string | null }> {
    return { spreadsheetUrl: null };
  }
}

export function getSheetsExporter(): SheetsExporter {
  const provider = process.env.SHEETS_PROVIDER ?? 'noop';
  switch (provider) {
    case 'google':
      throw new Error('SheetsExporter "google" se implementa en U6 (requiere OAuth).');
    case 'noop':
    default:
      return new NoopSheetsExporter();
  }
}
