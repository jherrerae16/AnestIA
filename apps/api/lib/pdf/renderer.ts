import { chromium, type Browser } from 'playwright';
import { EMPTY_HEADER_TEMPLATE } from '@anestia/shared';
import { logger } from '../logger';

/**
 * PdfRenderer — HTML → PDF con Playwright (Chromium headless). Reutiliza el browser
 * (singleton) entre renders. setContent (no navega a URLs externas).
 */
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true });
  logger.info('chromium_launched');
  return browser;
}

/**
 * `footerTemplate` va al margin box de Chromium, que reserva el espacio en TODAS las páginas.
 * Por eso el margen inferior (18mm) es mayor que el resto: es el hueco del pie. Un pie dentro
 * del body no serviría — el contenido de las páginas siguientes se le monta encima.
 */
export async function renderPdf(html: string, footerTemplate?: string): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: !!footerTemplate,
      headerTemplate: EMPTY_HEADER_TEMPLATE,
      footerTemplate: footerTemplate ?? EMPTY_HEADER_TEMPLATE,
      margin: { top: '12mm', bottom: '18mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closeRenderer(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
