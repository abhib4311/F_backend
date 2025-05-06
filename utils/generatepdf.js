import puppeteer from "puppeteer";

const generatepdf = async (html, options = {}) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    // If returnBuffer is true, return the raw buffer
    // Otherwise convert to base64 for backward compatibility
    if (options.returnBuffer) {
      return pdfBuffer;
    } else {
      return pdfBuffer.toString('base64');
    }

  } finally {
    await browser.close();
  }
};

export default generatepdf;