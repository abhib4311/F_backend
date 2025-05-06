import puppeteer from "puppeteer";

const convertHtmlToPdfBase64 = async (htmlContent) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    return Buffer.from(pdfBuffer).toString('base64');
  } catch (error) {
    console.error('Error converting HTML to PDF:', error?.message || error);
    return null;
  }
};

export default convertHtmlToPdfBase64;