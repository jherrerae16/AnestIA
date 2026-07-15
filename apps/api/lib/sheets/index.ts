import { logger } from '../logger';

/**
 * SheetsExporter — exportación opcional a Google Sheets (bajo demanda, U6).
 * PostgreSQL sigue siendo la fuente de verdad; esto es downstream, nunca disparador.
 * Modo `google`: service account (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SHEETS_SPREADSHEET_ID).
 */
export interface SheetRow {
  paciente: string;
  documento: string;
  procedimiento: string;
  estado: string;
  fecha: string;
}

export interface SheetsExporter {
  export(rows: SheetRow[]): Promise<{ spreadsheetUrl: string | null }>;
}

class NoopSheetsExporter implements SheetsExporter {
  async export(_rows: SheetRow[]): Promise<{ spreadsheetUrl: string | null }> {
    return { spreadsheetUrl: null };
  }
}

/** Export real vía service account de Google Cloud. */
class GoogleSheetsExporter implements SheetsExporter {
  async export(rows: SheetRow[]): Promise<{ spreadsheetUrl: string | null }> {
    const { google } = await import('googleapis');
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    // Credenciales: por ruta de archivo (GOOGLE_SERVICE_ACCOUNT_FILE) o JSON inline (GOOGLE_SERVICE_ACCOUNT_JSON).
    let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    if (!raw && file) {
      const { readFile } = await import('node:fs/promises');
      raw = await readFile(file, 'utf8');
    }
    if (!raw || !spreadsheetId) {
      throw new Error('Sheets "google" requiere GOOGLE_SERVICE_ACCOUNT_FILE (o _JSON) y GOOGLE_SHEETS_SPREADSHEET_ID.');
    }
    const credentials = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const values = rows.map((r) => [r.paciente, r.documento, r.procedimiento, r.estado, r.fecha]);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    logger.info({ count: rows.length }, 'sheets_export');
    return { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` };
  }
}

export function getSheetsExporter(): SheetsExporter {
  const provider = process.env.SHEETS_PROVIDER ?? 'noop';
  switch (provider) {
    case 'google':
      return new GoogleSheetsExporter();
    case 'noop':
    default:
      return new NoopSheetsExporter();
  }
}
