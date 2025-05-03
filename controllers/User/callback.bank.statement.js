//bsa
import { Prisma, PrismaClient } from "@prisma/client";
import { ResponseError } from "../../utils/responseError.js";
import FormData from "form-data";
import fetch from "node-fetch";
import { uploadFileToS3 } from "../../utils/uploadFilesS3.js";
import { handleThirdPartyResponse } from "../../utils/apiResponse.js";
import { API_TYPE } from "../../constants/constants.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { API_PATHS } from "../../constants/urlConstants.js";
// import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs.GlobalWorkerOptions.workerPort = null;

const prisma = new PrismaClient();

const downloadBsaCartApi = async (
  docId
  //  pan, userId, leadId
) => {
  try {
    const downloadRequestConfig = {
      method: "POST",
      headers: {
        "auth-Token": process.env.CART_API_AUTH,
        "Content-Type": "text/plain",
      },
      body: docId,
    };
    // await new Promise((resolve) => setTimeout(resolve, 6 * 1000));
    let response = await fetch(
      process.env.CARTBI_API_DOWNLOAD_URL,
      downloadRequestConfig
    );
       
    let responseData = await response.json();

    // while (responseData.status === "In Progress") {
    //   console.log("Waiting for 6 seconds before retrying download...");
    //   // Wait for 6 seconds before retrying
    //   await new Promise((resolve) => setTimeout(resolve, 6 * 1000));
    //   response = await fetch(
    //     process.env.CARTBI_API_DOWNLOAD_URL,
    //     downloadRequestConfig
    //   );

    //   if (!response.ok) {
    //     const errorText = await response.text();
    //     throw new ResponseError(
    //       response.status,
    //       `Failed to download file from API: HTTP ${response.status}. Response: ${errorText}`
    //     );
    //   }
    //   responseData = await response.json();
    // }
    // await asyncThirdPartyApiLogs(
    //   pan,
    //   API_TYPE.BANK_STATEMENT_DOWNLOAD,
    //   -1,
    //   downloadRequestConfig,
    //   responseData,
    //   true,
    //   userId,
    //   leadId
    // );

    return responseData;
  } catch (error) {
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || "Third-Party API returned an error"
      );
    } else {
      throw new ResponseError(
        500,
        error.message || "Failed to connect to Third-Party API"
      );
    }
  }
};
const estimateSalary = (data) => {
  const salaries = data.data[0].salary;
  let totalSalary = 0;
  const lastThreeMonths = salaries.slice(-3); // Get the last three months

  for (let i = 0; i < lastThreeMonths.length; i++) {
    const month = lastThreeMonths[i].month;
    totalSalary += parseFloat(lastThreeMonths[i].totalSalary);
  }
  const averageThreeMonthsSalary = totalSalary / 3;
  const salary = Math.round(averageThreeMonthsSalary);
  return salary;
};
const applyMultipliers = (salary, score, type) => {
  let maxLoanAmount = 0;
  if (type === "CIBIL") {
    if (score >= 780) {
      maxLoanAmount = salary * 0.65;
    } else if (score >= 750) {
      maxLoanAmount = salary * 0.5;
    } else if (score >= 700) {
      maxLoanAmount = salary * 0.3;
    } else if (score >= 650) {
      maxLoanAmount = salary * 0.2;
    }
  } else {
    // Handle other types of scores here
  }
  return maxLoanAmount;
};
const performFraudCheck = (data) => {
  //checking if the format of the data is correct
  if (!data || !data.data || !data.data[0]) {
    console.error("Invalid data structure:", data);
    return {
      basicValidationStatus: false,
      message: "Invalid data structure",
      fraud: false,
    };
  }

  //checking if we have atleast have a bankind data of 90 days
  const accountData = data.data[0];
  const periodStart = new Date(accountData.periodStart);
  const periodEnd = new Date(accountData.periodEnd);
  const timeDifference = periodEnd - periodStart;
  const dayDifference = timeDifference / (1000 * 60 * 60 * 24);

  if (dayDifference < 90) {
    return {
      basicValidationStatus: false,
      message: "Bank statement period is less than 90 days",
      fraud: false,
    };
  }
  /**************************************************************************************************** */
  const fraudScore = accountData.fraudScore;
  if (fraudScore > 2.5) {
    return {
      basicValidationStatus: false,
      message: data.message,
      fraud: true,
    };
  }
  /**************************************************************************************************** */

  //checking that the salary is not missing for any of the last 3 months
  const salaries = accountData.salary;
  let totalSalary = 0;
  if (!Array.isArray(salaries) || salaries.length < 3) {
    return {
      basicValidationStatus: false,
      message: "Insufficient salary data for the last three months",
      fraud: false,
    };
  }
  const lastThreeMonths = salaries.slice(-3);

  for (let i = 0; i < lastThreeMonths.length; i++) {
    const month = lastThreeMonths[i].month;
    if (lastThreeMonths[i].totalSalary === 0) {
      return {
        basicValidationStatus: false,
        message: `Salary not available for ${month}`,
        fraud: false,
      };
    }
  }
  return {
    basicValidationStatus: true,
    message: "Basic validation passed",
    fraud: false,
  };
};
const repaymentDate = (data) => {
  const salaries = data.data[0].salary;
  const lastThreeMonths = salaries.slice(-3); // Get the last three months

  // Extract transaction dates from the last three months
  const lastThreeDates = lastThreeMonths.map(
    (month) => month.transactions[0].transactionDate // Assuming one transaction per month
  );

  // Calculate the average timestamp
  const totalTimestamp = lastThreeDates.reduce((sum, date) => sum + date, 0);
  const averageTimestamp = totalTimestamp / lastThreeDates.length;

  // Convert the average timestamp to a Date object
  const averageDate = new Date(averageTimestamp);

  return averageDate; // Return the average date in Date format
};
// async function checkKeywordsInFirstPage(file) {
//   try {
//     const data = new Uint8Array(file.data);
//     const loadingTask = pdfjs.getDocument(data);
//     const pdfDoc = await loadingTask.promise;

//     const firstPage = await pdfDoc.getPage(1);
//     const textContent = await firstPage.getTextContent();
//     const text = textContent.items.map((item) => item.str).join(" ");
//     const lowerCaseText = text.toLowerCase();
//     const hasAccount = lowerCaseText.includes("account");
//     const hasBank = lowerCaseText.includes("bank");
//     const hasStatement = lowerCaseText.includes("statement");

//     return hasAccount || hasBank || hasStatement;
//   } catch (error) {
//     console.error("Error checking PDF keywords:", error);
//     return false;
//   }
// }
// const asyncThirdPartyApiLogs = async (
//   pan,
//   apiType,
//   apiProvider,
//   apiRequest,
//   apiResponse,
//   apiStatus,
//   userId,
//   leadId
// ) => {
//   await prisma.api_Logs.create({
//     data: {
//       pan: pan,
//       api_type: apiType,
//       customer_id: userId,
//       lead_id: leadId,
//       api_request: apiRequest,
//       api_response: apiResponse,
//       api_provider: apiProvider,
//       api_status: apiStatus,
//     },
//   });
// };
// const asyncLeadLogs = async (userId, leadId, pan, remarks) => {
//   await prisma.lead_Logs.create({
//     data: {
//       customer_id: userId,
//       lead_id: leadId,
//       pan: pan,
//       remarks: remarks,
//     },
//   });
// };

const callbackBankStatement = asyncHandler(async (req, res) => {
  try {
       console.log("sachin",req.body);
    let is_bre_complete = false;
    let is_bsa_complete = false;
    let is_bre_reject = false;

    const user = req.user;

    const {
      docId,
      requestId,
      status,
      reportFileName,
      endTime,
      message,
      fileNo,
    } = req.body;

    if (status === "Rejected") {
      return res.status(400).json({
        message: ` ${message}`,
        isFraud: false,
        isSuccess: true,
        remarks: "Bank Upload 3rd party api, respo",
      });
    }

    // if (status === "Pending") {
    //   return res
    //     .status(400)
    //     .json({ message: "Req is pending from the customer" });
    // }
    // if (status === "In Progress") {
    //   return res.status(400).json({ message: "Req is in progress" });
    // }
    if (status === "Processed") {
       
      // const breRequestConfig = {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(bureauReport.api_response),
      // };

      // const breUrl =
      //   process.env.NODE_ENV === "production"
      //     ? process.env.BRE_API_URL
      //     : process.env.BRE_API_URL_DEV;
      // const breResponse = await fetch(API_PATHS.CIBIL_URL, breRequestConfig);

      // if (!breResponse.ok) {
      //   throw new ResponseError(breResponse.status, `Something went wrong!`);
      // }

      // await asyncLeadLogs(userId, leadId, pan, "BRE Ran Successfully");
      // const breResponseData = await breResponse.json();

      // if (breResponseData.finalDecision === "REJECT") {
      //   is_bre_complete = true;
      //   is_bre_reject = true;
      // }

      // await asyncLeadLogs(
      //   userId,
      //   leadId,
      //   pan,
      //   "BRE Ran Successfully : " + breResponseData.finalDecision
      // );

      // await prisma.api_Logs.create({
      //   data: {
      //     customer_id: userId,
      //     lead_id: lead.id,
      //     pan: pan,
      //     api_type: "BRE",
      //     api_response: {
      //       is_success: true,
      //       apimsg: breResponseData,
      //     },
      //     api_provider: 0,
      //     api_request: breRequestConfig,
      //     api_status: breResponse.ok,
      //   },
      // });

      const downloadResponse = await downloadBsaCartApi(
        docId
        //   pan,
        //   userId,
        //   leadId
      );
      console.log("bsa report",downloadResponse);

      if (downloadResponse.status === "Rejected") {
        return res.status(400).json({
          message: `Wrong file upload : ${downloadResponse.message}`,
        });
      }
      if (!downloadResponse?.data || !downloadResponse.data[0]) {
        return res
          .status(400)
          .json({ message: "Invalid or missing bank details in the response" });
      }
      // await asyncLeadLogs(userId, leadId, pan, "BS Downloaded Successfully");
      // await prisma.bank_Statement_Report.create({
      //   data: {
      //     pan: pan,
      //     api_provider: -1,
      //     api_request: {
      //       docId: docId,
      //     },
      //     api_response: {
      //       is_success: true,
      //       apimsg: downloadResponse,
      //     },
      //     api_status: true,
      //     customer_id: userId,
      //     lead_id: lead.id,
      //   },
      // });

      console.log("Performing Fraud Check");

      const fraudCheck = performFraudCheck(downloadResponse);
      console.log("fraudCheck ---> ", fraudCheck);

      if (!fraudCheck.basicValidationStatus) {
        is_bre_reject = true;
        if (fraudCheck.fraud) {
          // await asyncLeadLogs(userId, leadId, pan, "FRAUD DETECTED!!!");
        }
        return res.status(400).json({
          isSuccess: true,
          message: fraudCheck.message,
          fraud: fraudCheck.fraud,
        });
      }

      const bankDetails = downloadResponse?.data[0];
      const {
        bankName,
        branchName,
        accountNumber,
        ifscCode,
        accountType,
        accountName,
      } = bankDetails;

      await prisma.bank_Details.create({
        data: {
          customer_id: userId,
          lead_id: lead.id,
          pan: pan,
          bank_name: bankName,
          branch_name: branchName,
          bank_acc_no: accountNumber,
          ifsc_code: ifscCode,
          account_type: accountType,
          beneficiary_name: accountName,
        },
      });

      const averageSalary = parseFloat(estimateSalary(downloadResponse));
      const repaymentDateValue = repaymentDate(downloadResponse);

      console.log("Calulating maxLoanAmount");

      const maxLoanAmount = applyMultipliers(averageSalary, score, "CIBIL");
      if (maxLoanAmount === 0) {
        return res.status(400).json({
          message: "No loan amount available for the given Credit Score",
        });
      }

      if (maxLoanAmount > 100000) maxLoanAmount = 100000;

      let lead_stage = is_bre_reject ? "BRE_REJECTED" : "BRE_APPROVED";

      await prisma.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          elegible_loan_amount: maxLoanAmount,
          is_bre_complete: true,
          is_bsa_complete: true,
          lead_stage: lead_stage,
          salary_date: repaymentDateValue,
        },
      });
      console.log(
        "*************************************************** 3 *******************************************************************"
      );

      console.log("All correct");
      // await asyncLeadLogs(userId, leadId, pan, "BSA + BRE ran successfully");

      return res.status(200).json({
        isSuccess: true,
        averageSalary,
        breResponseData,
        bre_loan_amount: breResponseData?.finalDecision?.loanAmount,
        is_bre_complete,
        is_bre_reject,
        message: "File uploaded successfully",
        maxLoanAmount,
        accountNumber,
        bankName,
        branchName,
        accountNumber,
        ifscCode,
        accountType,
        salaryDate: repaymentDateValue,
      });
    }
  } catch (error) {
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || "Third-Party API returned an error"
      );
    } else {
      throw new ResponseError(
        500,
        error.message || "Failed to connect to Third-Party API"
      );
    }
  }
});

export { callbackBankStatement };
