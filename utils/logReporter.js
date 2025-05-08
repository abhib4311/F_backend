import fs from "fs";
import path from "path";
import cron from "node-cron";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import nodemailer from "nodemailer";
import logger from "./logger.js";

const logsDir = "logs";
const reportDir = "log-reports";

// Ensure directories exist
[logsDir, reportDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateReports = async (date) => {
  const logFile = path.join(logsDir, `${date}-error.log`);

  if (!fs.existsSync(logFile)) {
    throw new Error("Log file not found");
  }

  const logLines = fs.readFileSync(logFile, "utf-8")
    .split("\n")
    .filter(Boolean);

  // Generate CSV
  const csvPath = path.join(reportDir, `error-report-${date}.csv`);
  fs.writeFileSync(csvPath, logLines.join("\n"));

  // Generate PDF
  const pdfPath = path.join(reportDir, `error-report-${date}.pdf`);
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(pdfPath));
  doc.fontSize(16).text(`Error Report - ${date}`, { underline: true });
  doc.moveDown();
  logLines.forEach((line, i) => doc.fontSize(10).text(`${i + 1}. ${line}`));
  doc.end();

  return { csvPath, pdfPath };
};

const sendEmail = async (date, attachments) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `BLINKR Error Report - ${date}`,
    text: "Attached are the error reports",
    attachments
  };

  await transporter.sendMail(mailOptions);
};

const sendLogReport = async () => {
  try {
    const date = format(new Date(), "yyyy-MM-dd");
    const { csvPath, pdfPath } = await generateReports(date);

    await sendEmail(date, [
      { path: csvPath },
      { path: pdfPath }
    ]);

    logger.info("Successfully sent log report");

    // Cleanup files
    [csvPath, pdfPath].forEach(file => fs.unlinkSync(file));
  } catch (error) {
    logger.error("Failed to send log report", { error });
    throw error;
  }
};

// Schedule weekly report
cron.schedule("0 10 * * 0", () => {
  logger.info("Starting log report job...");
  sendLogReport()
    .then(() => logger.info("Log report job completed"))
    .catch(error => logger.error("Log report job failed", { error }));
});

logger.info("Log reporter initialized");