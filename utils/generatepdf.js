import puppeteer from "puppeteer";


const convertHtmlToPdfBase64 = async (htmlContent) => {
  try {
    console.log("HTML content received for PDF generation:---->");
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser', // or use Puppeteer’s downloaded one
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });
    console.log("Puppeteer browser launched successfully.-->", browser);
    const page = await browser.newPage();
    console.log("New page created successfully.--->", page);


    await page.setContent(htmlContent, { waitUntil: "load" });


    const pdfBuffer = await page.pdf({ format: "A4" });
    console.log("PDF buffer generated successfully.---->", pdfBuffer);


    // const base64PDF = Buffer.from(pdfBuffer).toString("base64");
    // console.log("Base64 PDF generated successfully.--------->");

    console.log("PDF generated successfully.--->", base64PDF);

    return pdfBuffer;
  } catch (error) {
    console.log("Error converting HTML to PDF:------->", error);
    return false;
  }
  finally {
    await browser.close();
    console.log("Puppeteer browser closed successfully.----->");
  }
};
export default convertHtmlToPdfBase64;