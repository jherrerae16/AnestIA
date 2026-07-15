import { chromium, type Browser } from 'playwright';
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

export async function renderPdf(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '14mm', left: '10mm', right: '10mm' },
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
