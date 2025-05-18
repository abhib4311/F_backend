//bsa
import { Prisma, PrismaClient } from "@prisma/client";
import { ResponseError } from "../../utils/responseError.js";
import FormData from "form-data";
import fetch from "node-fetch";
import { uploadFileToS3 } from "../../utils/uploadFilesS3.js";
import { handleThirdPartyResponse } from "../../utils/apiResponse.js";
import { API_TYPE } from "../../constants/constants.js";
import asyncHandler from "../../utils/asyncHandler.js";
// import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs.GlobalWorkerOptions.workerPort = null;

const prisma = new PrismaClient();

const uploadBsaCartApiInitiate = async (
  file,
  userId,
  leadId,
  pan,
  password
) => {
  try {
    console.log("file-1 --------------------------------->");
    const uploadedFile = file;
    console.log("file-2 --------------------------------->", uploadedFile);
    const form = new FormData();
    console.log("form --------------------------------->", form);

    form.append("file", uploadedFile.data, {
      filename: uploadedFile.name,
      contentType: uploadedFile.mimetype,
    });
    console.log("form-1 --------------------------------->");
    const metadata = {
      password: password || "",
      bank: "Other",
      name: "Blinkr",
      productType: "Salaried",
    };
    form.append("metadata", JSON.stringify(metadata));
    console.log("form-2 --------------------------------->");

    const documentDetails = [
      {
        groupCompany: "",
        accountNumber: "",
        accountType: "",
        internal: "true",
        odCclimit: 50000,
        organizationName: "employerName",
      },
    ];
    form.append("documentDetails", JSON.stringify(documentDetails));
    console.log("form-3 --------------------------------->");

    const uploadRequestConfig = {
      method: "POST",
      headers: {
        "auth-Token": process.env.CART_API_AUTH,
        ...form.getHeaders(),
      },
      body: form.getBuffer(),
    };
    console.log(
      "uploadRequestConfig --------------------------------->",
      uploadRequestConfig
    );
    const uploadResponse = await fetch(
      process.env.CARTBI_API_UPLOAD,
      uploadRequestConfig
    );
    console.log(
      "uploadResponse --------------------------------->",
      uploadResponse
    );
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new ResponseError(
        uploadResponse?.status || 500,
        `Failed to upload file: HTTP ${
          uploadResponse?.status || "unknown"
        }. Response: ${errorText || "No response text available"}`
      );
    }

    const uploadResponseData = await uploadResponse.json();
    await asyncThirdPartyApiLogs(
      pan,
      API_TYPE.BANK_STATEMENT_UPLOAD,
      -1,
      uploadRequestConfig,
      uploadResponseData,
      true
    );
    console.log(
      "uploadResponseData --------------------------------->",
      uploadResponseData
    );

    return uploadResponseData;
  } catch (error) {
    console.error("Send OTP API Error:", error);
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
const downloadBsaCartApi = async (docId, pan, userId, leadId) => {
  try {
    const downloadRequestConfig = {
      method: "POST",
      headers: {
        "auth-Token": process.env.CART_API_AUTH,
        "Content-Type": "text/plain",
      },
      body: docId,
    };
    await new Promise((resolve) => setTimeout(resolve, 6 * 1000));
    let response = await fetch(
      process.env.CARTBI_API_DOWNLOAD_URL,
      downloadRequestConfig
    );

    let responseData = await response.json();

    while (responseData.status === "In Progress") {
      console.log("Waiting for 6 seconds before retrying download...");
      // Wait for 6 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 6 * 1000));
      response = await fetch(
        process.env.CARTBI_API_DOWNLOAD_URL,
        downloadRequestConfig
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new ResponseError(
          response.status,
          `Failed to download file from API: HTTP ${response.status}. Response: ${errorText}`
        );
      }
      responseData = await response.json();
    }
    await asyncThirdPartyApiLogs(
      pan,
      API_TYPE.BANK_STATEMENT_DOWNLOAD,
      -1,
      downloadRequestConfig,
      responseData,
      true,
      userId,
      leadId
    );

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
    totalSalary += parseFloat(lastThreeMonths[i]?.totalSalary);
  }
  const averageThreeMonthsSalary = totalSalary / 3;
  const salary = Math.round(averageThreeMonthsSalary);
  return salary;
};
const applyMultipliers = (amount, score, type) => {
  let maxLoanAmount = 0;
  if (type === "CIBIL") {
    if (score >= 780) {
      maxLoanAmount = amount * 0.65;
    } else if (score >= 750) {
      maxLoanAmount = amount * 0.5;
    } else if (score >= 700) {
      maxLoanAmount = amount * 0.3;
    } else if (score >= 600) {
      maxLoanAmount = amount * 0.2;
    }
  } else if (type === "WHITE_LISTED") {
    if (score >= 750) {
      maxLoanAmount = amount * 0.8;
    } else if (score >= 700) {
      maxLoanAmount = amount * 0.75;
    } else if (score >= 650) {
      maxLoanAmount = amount * 0.65;
    } else {
      maxLoanAmount = amount * 0.5;
    }
  } else {
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
    if (lastThreeMonths[i]?.totalSalary === 0) {
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
  const averageTimestamp = salaries[0].transactions[0].transactionDate;
  const averageDate = new Date(averageTimestamp);

  return averageDate; // Return the average date in Date format
};
async function checkKeywordsInFirstPage(file) {
  try {
    const data = new Uint8Array(file.data);
    const loadingTask = pdfjs.getDocument(data);
    const pdfDoc = await loadingTask.promise;

    const firstPage = await pdfDoc.getPage(1);
    const textContent = await firstPage.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    const lowerCaseText = text.toLowerCase();
    const hasAccount = lowerCaseText.includes("account");
    const hasBank = lowerCaseText.includes("bank");
    const hasStatement = lowerCaseText.includes("statement");

    return hasAccount || hasBank || hasStatement;
  } catch (error) {
    console.error("Error checking PDF keywords:", error);
    return false;
  }
}
const asyncThirdPartyApiLogs = async (
  pan,
  apiType,
  apiProvider,
  apiRequest,
  apiResponse,
  apiStatus,
  userId,
  leadId
) => {
  await prisma.api_Logs.create({
    data: {
      pan: pan,
      api_type: apiType,
      customer_id: userId,
      lead_id: leadId,
      api_request: apiRequest,
      api_response: apiResponse,
      api_provider: apiProvider,
      api_status: apiStatus,
    },
  });
};
const asyncLeadLogs = async (userId, leadId, pan, remarks) => {
  await prisma.lead_Logs.create({
    data: {
      customer_id: userId,
      lead_id: leadId,
      pan: pan,
      remarks: remarks,
    },
  });
};

const getSalary = (data) => {
  const salaries = data?.data?.[0]?.salary;
  if (!Array.isArray(salaries)) {
    console.error("Salary data is not an array");
    return 0;
  }
  if (salaries.length === 0) {
    console.error("No salary entries found");
    return 0;
  }
  const firstSalaryEntry = salaries[0];
  if (
    !firstSalaryEntry ||
    typeof firstSalaryEntry.totalSalary === "undefined"
  ) {
    console.error("Total salary is missing in the first entry");
    return 0;
  }
  return firstSalaryEntry.totalSalary;
};

/*
const checkWhiteListedUser = async (pan) => {
  console.log("Hii----------- 1")
  const whiteListedUser = await prisma.whitelisted_users.findFirst({
    where: {
      pan: pan,
    },
  });
  console.log("Hii----------- 2" , whiteListedUser)
  if (whiteListedUser) return true;
  return false;
}
*/

const checkWhiteListedUser = false;

const uploadBankStatement = asyncHandler(async (req, res) => {
  try {
    let is_bre_complete = false;
    let is_bsa_complete = false;
    let is_bre_reject = false;

    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const userId = user.id;
    const userDetails = await prisma.customer.findUnique({
      where: {
        id: userId,
      },
    });
    if (!userDetails) {
      return res.status(404).json({ message: "UserDetails not found" });
    }
    const { pan, dob } = userDetails;
    if (!pan || !dob) {
      return res
        .status(400)
        .json({ message: "PAN or DOB is missing in user details" });
    }
    const lead = await prisma.lead.findFirst({
      where: {
        customer_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    const leadId = lead.id;

    const bureauReport = await prisma.api_Logs
      .findFirst({
        where: {
          pan: pan,
          api_type: "CREDIT_REPORT",
        },
        orderBy: {
          created_at: "desc",
        },
      })
      .then(console.log("bureauReport---->>>PULLED FROM DB"));

    if (!bureauReport.api_response.success) {
      return res
        .status(400)
        .json({ message: "Bureau was not pulled correctly" });
    }

    const score = bureauReport?.api_response?.data?.credit_score || null;
    if (!score) {
      return res.status(400).json({
        message:
          "Credit Score not found, will be contacted by our team manually",
      });
    }
    if (!req.files || !req.files.file) {
      return res
        .status(400)
        .json({ message: "File not uploaded from the web" });
    }
    const uploadedFile = req.files.file;
    const password = req.headers["password"];

    if (uploadedFile.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Uploaded File is not a PDF" });
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    const apiUploadResponse = await uploadBsaCartApiInitiate(
      uploadedFile,
      userId,
      leadId,
      pan,
      password
    );

    if (apiUploadResponse.status === "Rejected") {
      return res.status(400).json({
        message: `Wrong file upload : ${apiUploadResponse.message}`,
        isFraud: false,
        isSuccess: true,
        remarks: "Bank Upload 3rd party api, respo",
      });
    }

    const result = await uploadFileToS3(req.files.file, bucketName, pan);
    if (!result || !result.Location) {
      console.error("Failed to upload file to S3:", result);
      return res.status(500).json({
        message: "Failed to upload file, please try again!",
        isFraud: false,
        isSuccess: true,
        remarks: "Failed to upload file to S3",
      });
    }
    await asyncLeadLogs(userId, leadId, pan, "BS Uploaded to S3 successfully");

    const s3Url = result.Location;
    await prisma.document.create({
      data: {
        pan: pan,
        document_type: "BANK_STATEMENT",
        document_url: s3Url,
        customer_id: userId,
        lead_id: lead.id,
        remarks: password,
      },
    });

    // const isWhitelisted = await checkWhiteListedUser(pan);

    const isWhitelisted = false;

    const breRequestConfig = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "customer-type": isWhitelisted ? "whitelisted" : "",
      },
      body: JSON.stringify(bureauReport.api_response),
    };

    const breUrl =
      process.env.NODE_ENV === "production"
        ? process.env.BRE_API_URL
        : process.env.BRE_API_URL_DEV;
    const breResponse = await fetch(
      "https://bre.fundobaba.com/v1/api/cibil",
      breRequestConfig
    );

    if (!breResponse.ok) {
      throw new ResponseError(breResponse.status, `Error Came from BRE`);
    }

    await asyncLeadLogs(userId, leadId, pan, "BRE Ran Successfully");
    const breResponseData = await breResponse.json();

    if (breResponseData.finalDecision === "REJECT") {
      is_bre_complete = true;
      is_bre_reject = true;
    }

    await asyncLeadLogs(
      userId,
      leadId,
      pan,
      "BRE Ran Successfully : " + breResponseData.finalDecision
    );

    await prisma.api_Logs.create({
      data: {
        customer_id: userId,
        lead_id: lead.id,
        pan: pan,
        api_type: "BRE",
        api_response: {
          is_success: true,
          apimsg: breResponseData,
        },
        api_provider: 0,
        api_request: breRequestConfig,
        api_status: breResponse.ok,
      },
    });

    const docId = apiUploadResponse.docId;

    const downloadResponse = await downloadBsaCartApi(
      docId,
      pan,
      userId,
      leadId
    );

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
    await asyncLeadLogs(userId, leadId, pan, "BS Downloaded Successfully");
    await prisma.bank_Statement_Report.create({
      data: {
        pan: pan,
        api_provider: -1,
        api_request: {
          docId: docId,
        },
        api_response: {
          is_success: true,
          apimsg: downloadResponse,
        },
        api_status: true,
        customer_id: userId,
        lead_id: lead.id,
      },
    });

    // const fraudCheck = performFraudCheck(downloadResponse);
    // console.log("fraudCheck ---> ", fraudCheck);

    // if (!fraudCheck.basicValidationStatus) {
    //   is_bre_reject = true;
    //   if (fraudCheck.fraud) {
    //     await asyncLeadLogs(userId, leadId, pan, "FRAUD DETECTED!!!");
    //   }
    //   return res.status(400).json({
    //     isSuccess: true,
    //     message: fraudCheck.message,
    //     fraud: fraudCheck.fraud,
    //   });
    // }

    const bankDetails = downloadResponse?.data[0];
    const {
      bankName,
      branchName,
      accountNumber,
      ifscCode,
      accountType,
      accountName,
    } = bankDetails;

    // if (
    //   !bankName ||
    //   !branchName ||
    //   !accountNumber ||
    //   !ifscCode ||
    //   !accountType ||
    //   !accountName
    // ) {
    //   return res
    //     .status(400)
    //     .json({ message: "Incomplete bank details in the response" });
    // }

    // const averageSalary = parseFloat(estimateSalary(downloadResponse));
    const averageSalary = parseFloat(getSalary(downloadResponse));
    if (isNaN(averageSalary) || averageSalary <= 0) {
      return res.status(400).json({
        message: "Valid salary data not found in the bank statement.",
        isSuccess: false,
      });
    }
    const repaymentDateValue = repaymentDate(downloadResponse);
    /*
        const whiteListedUser = await prisma.whitelisted_users.findFirst({
          where: {
            pan: pan,
          },
        });
    */
    await prisma.customer.update({
      where: {
        id: userId,
      },
      data: {
        monthly_income: averageSalary,
      },
    })
    console.log("Performing Fraud Check");
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

    // let maxLoanAmount = !isWhitelisted ? applyMultipliers(averageSalary, score, "CIBIL") : applyMultipliers(whiteListedUser?.previous_loan_amount, score, "WHITE_LISTED");
    let maxLoanAmount = applyMultipliers(averageSalary, score, "CIBIL");
    if (maxLoanAmount === 0) {
      return res.status(400).json({
        message: "No loan amount available for the given Credit Score",
      });
    }

    if (maxLoanAmount > 100000) maxLoanAmount = 100000;

    let lead_stage = is_bre_reject ? "BRE_REJECTED" : "BRE_APPROVED";
    let remarks = "BSA + BRE ran successfully";
    console.log("All correct");

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
        is_bre_reject,
      },
    });
    console.log(
      "*************************************************** 3 *******************************************************************"
    );
    if (!ifscCode) {
      console.log("IN IFSC CODE NOT FOUND");
      (is_bre_reject = true),
        await prisma.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            is_bre_reject: true,
            lead_stage: "BRE_REJECTED",
          },
        });
      console.log("is_bre_reject==>", is_bre_reject);
      remarks = "BSA REJECTED DUE TO NOT FOUND IFSC_CODE";
    }
    console.log("IN LAST -->", "is_bre_reject : ", is_bre_reject);
    await asyncLeadLogs(userId, leadId, pan, remarks);

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

export { uploadBankStatement };
