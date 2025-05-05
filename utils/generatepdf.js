import { chromium } from 'playwright';

const generatePdf = async (html) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  const pdfBuffer = await page.pdf({ format: 'A4' });

  await browser.close();
  return pdfBuffer.toString('base64');
};

export default generatePdf; 
