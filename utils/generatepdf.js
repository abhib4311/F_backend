import puppeteer from "puppeteer";


const convertHtmlToPdfBase64 = async (htmlContent) => {
  try {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();


    await page.setContent(htmlContent, { waitUntil: "load" });


    const pdfBuffer = await page.pdf({ format: "A4" });


    const base64PDF = Buffer.from(pdfBuffer).toString("base64");

    await browser.close();
    return base64PDF;
  } catch (error) {
    console.error("Error converting HTML to PDF:", error);
    return null;
  }
};
export default convertHtmlToPdfBase64;





