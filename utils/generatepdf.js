import puppeteer from "puppeteer";


const convertHtmlToPdfBase64 = async (htmlContent) => {
  try {
    console.log("HTML content received for PDF generation:---->");

    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Prevent /dev/shm usage issues
        '--disable-gpu',
        '--single-process', // Recommended for Docker environments
        '--no-zygote', // Disables zygote process for container optimization
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning'
      ],
      headless: "new" // or true (depending on Puppeteer version)
    });
    const page = await browser.newPage();


    await page.setContent(htmlContent, { waitUntil: "load" });


    const pdfBuffer = await page.pdf({ format: "A4" });
    console.log("PDF buffer generated successfully." , pdfBuffer);  


    // const base64PDF = Buffer.from(pdfBuffer).toString("base64");
    console.log("Base64 PDF generated successfully.--------->");

    await browser.close();
    console.log("PDF generated successfully.--->" , base64PDF);
    return pdfBuffer;
  } catch (error) {
    console.log("Error converting HTML to PDF:------->", error);
    return null;
  }
};
export default convertHtmlToPdfBase64;