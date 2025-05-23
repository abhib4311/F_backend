import puppeteer from "puppeteer";


const convertHtmlToPdfBase64 = async (htmlContent) => {
  let browser
  try {
    console.log("HTML content received for PDF generation:---->");
    // use this in production----------------------------------------------------------------->
    browser = await puppeteer.launch({
      executablePath: '/home/ubuntu/.cache/puppeteer/chrome/linux-136.0.7103.92/chrome-linux64/chrome', // or use Puppeteer’s downloaded one
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });
    // use this in development----------------------------------------------------------------->
    // browser = await puppeteer.launch({
    //   headless: true,
    //   args: ['--no-sandbox', '--disable-setuid-sandbox']
    // });
    console.log("Puppeteer browser launched successfully.-->", browser);
    const page = await browser.newPage();
    console.log("New page created successfully.--->", page);


    await page.setContent(htmlContent, { waitUntil: "load" });


    const pdfBuffer = await page.pdf({ format: "A4" });
    console.log("PDF buffer generated successfully.---->", pdfBuffer);


    // const base64PDF = Buffer.from(pdfBuffer).toString("base64");
    // console.log("Base64 PDF generated successfully.--------->");

    console.log("PDF generated successfully.--->", pdfBuffer);

    return pdfBuffer;
  } catch (error) {
    console.log("Error converting HTML to PDF:------->", error);
    return false;
  }
  finally {
    if (browser) {
      await browser.close();
    }
    console.log("Puppeteer browser closed successfully.----->");
  }
};
export default convertHtmlToPdfBase64;