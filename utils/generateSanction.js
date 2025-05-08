// Call the generateSanctionLetter utility function

import axios from "axios";
import { htmlToPdf } from "./htmlToPdf.js";
import { formatFullName } from "./nameFormatter.js";
import FormData from "form-data";
import { sanctionLetter } from "./sanctionLetter.js";
import {
    initiate,
    eSignStepTwo,
    eSignStepThree,
    eSignStepFour,
} from "../Controllers/eSignController.js";
import handlebars from "handlebars";
import * as fs from "fs";
import path from "path";
import { dateFormatter } from "./dateFormatter.js";
import { fileURLToPath } from "url";

export const generateSanctionLetter = async (
    subject,
    sanctionDate,
    title,
    loanNo,
    fullname,
    mobile,
    residenceAddress,
    stateCountry,
    camDetails,
    lead,
    docs
) => {
    try {
        const htmlToSend = sanctionLetter(
            sanctionDate,
            title,
            fullname,
            loanNo,
            lead.pan,
            mobile,
            residenceAddress,
            stateCountry,
            camDetails
        );

        // Convert the HTML to PDF
        const result = await htmlToPdf(docs, htmlToSend, "sanctionLetter");

        // Create form-data and append the PDF buffer
        const formData = new FormData();
        formData.append("files", Buffer.from(result.pdfBuffer), {
            filename: `sanction_${fullname}.pdf`,
            contentType: "application/pdf",
        });

        const stepOne = await initiate(formData);
        const stepTwo = await eSignStepTwo(stepOne.data.referenceId);
        const fullName = formatFullName(lead.fName, lead.mName, lead.lName);
        const stepThree = await eSignStepThree(
            lead._id.toString(),
            `${fullName}`,
            lead.aadhaar,
            stepTwo.data.file.directURL
        );
        const stepFour = await eSignStepFour(stepThree.data.referenceId);

        const letter = new FormData();
        letter.append("from", "credit@qualoan.com");
        letter.append("to", `${lead.personalEmail}`);
        letter.append("subject", `${subject}`);
        letter.append(
            "html",
            `<p>
                Please verify and E-sign the sanction letter to
                acknowledge.${" "}
                    ${stepFour.data.result.url}
            </p>`
        );

        // Setup the options for the ZeptoMail API
        const options = {
            method: "POST",
            url: "https://api.mailgun.net/v3/qualoan.com/messages",
            data: letter,
            headers: {
                accept: "application/json",
                authorization: `Basic ${process.env.MAILGUN_AUTH}`,
                ...formData.getHeaders(),
            },
        };

        // Make the request to the ZeptoMail API
        const response = await axios(options);
        if (
            response.data.id !== "" ||
            response.data.id !== null ||
            response.data.id !== undefined
        ) {
            return {
                success: true,
                message: "Sanction letter sent successfully",
            };
        }

        // Setup the options for the ZeptoMail API
        // const options = {
        //     method: "POST",
        //     url: "https://api.zeptomail.in/v1.1/email",
        //     headers: {
        //         accept: "application/json",
        //         authorization: `Zoho-enczapikey PHtE6r1eFL/rjzF68UcBsPG/Q8L1No16/b5jKgkU44hBCPMFS00Eo49/xjO/ohkqU6JBRqTJy45v572e4u/TcWflNm1JWGqyqK3sx/VYSPOZsbq6x00etVkdd03eVoLue95s0CDfv9fcNA==`,
        //         "cache-control": "no-cache",
        //         "content-type": "application/json",
        //     },
        //     data: JSON.stringify({
        //         from: { address: "credit@qualoan.com" },
        //         to: [
        //             {
        //                 email_address: {
        //                     address: lead.personalEmail,
        //                     name: fullname,
        //                 },
        //             },
        //         ],
        //         subject: subject,
        //         htmlbody: `<p>
        //                 Please verify and E-sign the sanction letter to
        //                 acknowledge.${" "}
        //                     ${stepFour.data.result.url}
        //             </p>`,
        //         // htmlbody: htmlToSend,
        //     }),
        // };

        // Make the request to the ZeptoMail API
        // const response = await axios(options);
        // if (response.data.message === "OK") {
        //     return {
        //         success: true,
        //         message: "Sanction letter sent successfully",
        //     };
        // }

        return {
            success: false,
            message: "Failed to send email",
        };
    } catch (error) {
        return {
            success: false,
            message: `"Error in ZeptoMail API" ${error.message}`,
        };
    }
};



export function sanctionLetter(
    sanctionDate,
    title,
    fullname,
    loanNo,
    pan,
    mobile,
    residenceAddress,
    stateCountry,
    camDetails
) {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const filePath = path.join(__dirname, "../config/sanction.html");
        const source = fs.readFileSync(filePath, "utf-8").toString();
        const template = handlebars.compile(source);

        let replacements = {
            sanctionDate: `${sanctionDate}`,
            title: `${title}`,
            fullname: `${fullname}`,
            loanNo: `${loanNo}`,
            pan: `${pan}`,
            residenceAddress: `${residenceAddress}`,
            stateCountry: `${stateCountry}`,
            mobile: `${mobile}`,
            loanAmount: `${new Intl.NumberFormat().format(
                camDetails?.loanRecommended
            )}`,
            roi: `${camDetails?.roi}`,
            disbursalDate: dateFormatter(camDetails?.disbursalDate),
            repaymentAmount: `${new Intl.NumberFormat().format(
                camDetails?.repaymentAmount
            )}`,
            tenure: `${camDetails?.eligibleTenure}`,
            totalInterest: `${new Intl.NumberFormat().format(
                Number(camDetails?.repaymentAmount) -
                Number(camDetails?.loanRecommended)
            )}`,
            repaymentDate: dateFormatter(camDetails?.repaymentDate),
            penalInterest: Number(camDetails?.roi) * 2,
            processingFee: `${new Intl.NumberFormat().format(
                camDetails?.netAdminFeeAmount
            )}`,

            disbursalAmount: `${new Intl.NumberFormat().format(
                camDetails?.netDisbursalAmount
            )}`,
            // repaymentCheques: `${camDetails?.details.repaymentCheques || "-"}`,
            // bankName: `${bankName || "-"}`,
            bouncedCharges: "1000",
            annualPercentage: `${((Number(camDetails?.roi) / 100) *
                    Number(camDetails?.eligibleTenure) +
                    Number(camDetails?.adminFeePercentage) / 100) *
                (365 / Number(camDetails?.eligibleTenure)) *
                100
                }%`,
        };

        let htmlToSend = template(replacements);

        // footer =
        //     "https://publicramlella.s3.ap-south-1.amazonaws.com/public_assets/Footer.jpg";
        // header =
        //     "https://publicramlella.s3.ap-south-1.amazonaws.com/public_assets/Header.jpg";

        console.log("htmlToSend ", htmlToSend);
        return htmlToSend;
    } catch (error) {
        return {
            success: false,
            message: `"Error in adding the template" ${error.message}`,
        };
    }
}



const emailResponse = await generateSanctionLetter(
    `SANCTION LETTER - ${response.fullname}`,
    dateFormatter(response.sanctionDate),
    response.title,
    response.loanNo,
    response.fullname,
    response.mobile,
    response.residenceAddress,
    response.stateCountry,
    camDetails,
    lead,
    docs,
    `${personalEmail}`
);

