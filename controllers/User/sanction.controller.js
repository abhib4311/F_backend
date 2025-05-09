import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();
import asyncHandler from "../../utils/asyncHandler.js";
import sanctionpage from "../../utils/sanction_loan.js";
import generatepdf from "../../utils/generatepdf.js";
import {
  getSingedDocUrl,
  sanctionAPI,
  disburseLoanAPI,
  esignInitAPI,
  getUploadUrlAPI,
} from "../../service/thirdParty.js";
import {
  handleSurepassResponse,
  handleThirdPartyResponse,
} from "../../utils/apiResponse.js";
import { uploadSanctionLetterS3 } from "../../utils/uploadSanction.js";
import {
  API_TYPE,
  DOCUMENT_TYPE,
  LEAD_STAGE,
} from "../../constants/constants.js";
import { ResponseError } from "../../utils/responseError.js";
import path from "path";
import convertImageToBase64 from "../../utils/imageToBase64.js";
import { fileURLToPath } from "url";
import { calculateRepaymentDate } from "../../utils/calculateTenure.js";
import { sendEncryptedRequest } from "./banking_integration.js";
import { sendDataToCredgenics } from "./credgenics.contoller.js";
import logger from "../../utils/logger.js";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getLoanDetails = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  // Cache lead details with minimal fields
  const lead = await prisma.lead.findFirst({
    where: { customer_id: customerId },
    orderBy: { created_at: "desc" },
    select: { id: true, is_rejected: true },
  });

  if (!lead) throw new ResponseError(400, "Lead not found");
  if (lead.is_rejected) throw new ResponseError(400, "Lead is rejected");

  // Parallel data fetching
  const [sanction, bank] = await Promise.all([
    prisma.sanction.findFirst({
      where: { lead_id: lead.id },
      orderBy: { created_at: "desc" },
      select: {
        tenure: true,
        loan_amount: true,
        interest_amount: true,
        processing_fee: true,
        repayment_amount: true,
      },
    }),
    prisma.bank_Details.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: "desc" },
      select: { bank_acc_no: true },
    }),
  ]);

  // Validate bank details
  if (!bank?.bank_acc_no?.length) {
    throw new ResponseError(400, "Bank details not found");
  }

  // Prepare response data with defaults
  const response = {
    tenure: sanction?.tenure || 0,
    loan_amount: sanction?.loan_amount || 0,
    interest_rate: sanction?.interest_amount || 0,
    processing_fee: sanction?.processing_fee || 0,
    repayment_amount: sanction?.repayment_amount || 0,
    disbursal_date: new Date(),
    masked_bank_no: bank.bank_acc_no
      .slice(-4)
      .padStart(bank.bank_acc_no.length, "X"),
  };

  return res.status(200).json({
    message: "Loan details fetched successfully",
    data: response,
  });
});

// export const previewSanction = asyncHandler(async (req, res) => {
//   const userId = req.user.id;

//   // Parallel fetch user and lead details
//   const [user, lead_detail] = await Promise.all([
//     prisma.customer.findUnique({ where: { id: userId } }),
//     prisma.lead.findFirst({
//       where: { customer_id: userId },
//       orderBy: { created_at: "desc" },
//     })
//   ]);

//   // Validation checks
//   if (!user) throw new ResponseError(400, "User not found");
//   if (!lead_detail) throw new ResponseError(400, "Lead not found");
//   if (lead_detail.is_rejected) throw new ResponseError(400, "Lead is rejected");
//   if (lead_detail.is_sanction) throw new ResponseError(400, "Sanction already completed");
//   if (!lead_detail.is_kyc_approved) throw new ResponseError(400, "Verify Your KYC first");

//   // Check existing sanction
//   const existingSanction = await prisma.sanction.findFirst({
//     where: { lead_id: lead_detail.id },
//   });
//   if (!existingSanction) throw new ResponseError(400, "Sanction not found");

//   // Calculate and update repayment details
//   const { tenure, repaymentDate } = calculateRepaymentDate(lead_detail.salary_date);
//   await Promise.all([
//     prisma.lead.update({
//       where: { id: lead_detail.id },
//       data: { tenure: Number(tenure), repayment_date: new Date(repaymentDate) },
//     }),
//     prisma.sanction.update({
//       where: { id: existingSanction.id },
//       data: { tenure: Number(tenure), repayment_date: new Date(repaymentDate) },
//     })
//   ]);

//   // Parallel image processing
//   const [headerImageBase64, footerImageBase64] = await Promise.all([
//     convertImageToBase64(path.join(__dirname, '../../public/images/Header.png')),
//     convertImageToBase64(path.join(__dirname, '../../public/images/Footer.png'))
//   ]);

//   // Generate PDF and call API
//   // const base64_encoded = await generatepdf(sanctionpage(
//   //   existingSanction,
//   //   lead_detail,
//   //   headerImageBase64,
//   //   footerImageBase64
//   // ));
//   const sanction_html_page = sanctionpage(
//     existingSanction,
//     lead_detail,
//     headerImageBase64,
//     footerImageBase64
//   );

//   const pdfBuffer = await generatepdf(sanction_html_page, { returnBuffer: true });

//   // Create a Blod/File from the buffer
//   const pdfFile = new File([pdfBuffer], 'sanction_letter.pdf', { type: 'application/pdf' });
//   // Step 2: Initialize e-Sign session
//   const initEsignPayload = {
//     pdf_pre_uploaded: true,
//     callback_url: "http://localhost:8000/api/user/redirect-url",
//     config: {
//       skip_otp: true,
//       auth_mode: "1",
//       reason: "Contract",
//       positions: {
//         1: [{ x: 10, y: 20 }]
//       }
//     },
//     prefill_options: {
//       full_name: user.full_name, // lead_detail.full_name,
//       mobile_number: user.mobile, // lead_detail.mobile,
//       user_email: user.personal_email // lead_detail.personal_email
//     }
//   };

//   // Call first API to initialize e-Sign
//   const { apiRequest: initRequest, apiResponse: initResponse } = await esignInitAPI(initEsignPayload);
//   // console.log("initResponse---->", initResponse);
//   // console.log("initRequest---->", initRequest);
//   if (initResponse?.status_code !== 200) {

//     handleThirdPartyResponse(initResponse);
//   }

//   const clientId = initResponse.data.client_id;
//   const esignUrl = initResponse.data.url;
//   // console.log("clientId---->", clientId);
//   // console.log("esignUrl---->", esignUrl);

//   // Step 3: Get upload URL
//   const { apiRequest: uploadUrlRequest, apiResponse: uploadUrlResponse } = await getUploadUrlAPI({ client_id: clientId });
//   // console.log("uploadUrlResponse---->", uploadUrlResponse);
//   // console.log("uploadUrlRequest---->", uploadUrlRequest);
//   if (uploadUrlResponse?.status_code !== 200) {
//     handleThirdPartyResponse(uploadUrlResponse);
//   }

//   // Step 4: Upload PDF to provided S3 URL
//   const uploadUrl = uploadUrlResponse.data.url;
//   const uploadFields = uploadUrlResponse.data.fields;
//   // console.log("uploadUrl---->", uploadUrl);
//   // console.log("uploadFields---->", uploadFields);

//   // if (pdfFile) {
//   //   console.log("pdfFile---->");
//   // }

//   // Step 5: Upload PDF to provided S3 URL
//   const formData = new FormData();
//   Object.entries(uploadFields).forEach(([key, value]) => {
//     formData.append(key, value);
//   });
//   formData.append('file', pdfFile);
//   // Step 6: Upload PDF to provided S3 URL
//   // console.log("formData---->", formData);
//   const uploadResponse = await fetch(uploadUrl, {
//     method: 'POST',
//     body: formData
//   });
//   // console.log("uploadResponse---->", uploadResponse);
//   if (!uploadResponse.ok) {
//     throw new ResponseError(400, "Error from Surepass e-Sign(uploadResponse function in sanction.controller.js) API : Failed to upload document");
//   }

//   // ------------------------------------------------------------

//   const { apiRequest, apiResponse } = await sanctionAPI(
//     base64_encoded,
//     lead_detail.full_name,
//     lead_detail.personal_email,
//     lead_detail.mobile,
//     lead_detail.id
//   );

//   // Handle API response
//   if (apiResponse?.statusCode != "101") handleThirdPartyResponse(apiResponse);
//   if (!apiResponse?.result?.documentId) throw new ResponseError(400, "Document ID not found");
//   if (!apiResponse?.result?.signingDetails[0]?.signUrl) throw new ResponseError(400, "Signed url not found");

//   const signUrl = apiResponse.result.signingDetails[0].signUrl;
//   const documentId = apiResponse.result.documentId;

//   // Transaction block with batched operations
//   await prisma.$transaction(async (prisma) => {
//     await Promise.all([
//       prisma.sanction.update({
//         where: { id: existingSanction.id },
//         data: { is_eSign_pending: true, document_id: documentId },
//       }),
//       prisma.api_Logs.create({
//         data: {
//           pan: user.pan,
//           api_type: API_TYPE.ESIGN_API,
//           api_provider: 1,
//           api_request: apiRequest,
//           api_response: apiResponse,
//           api_status: true,
//           lead_id: lead_detail.id,
//           customer_id: userId,
//         },
//       }),
//       prisma.lead.update({
//         where: { id: lead_detail.id },
//         data: { lead_stage: LEAD_STAGE.SANCTION_PENDING },
//       }),
//       prisma.lead_Logs.create({
//         data: {
//           customer_id: userId,
//           lead_id: lead_detail.id,
//           pan: user.pan,
//           remarks: "Sending for e-Sign"
//         },
//       })
//     ]);

//     res.status(200).json({
//       success: true,
//       message: "Sent for e-sign successfully!",
//       document_id: documentId,
//       signUrl: signUrl,
//     });
//   }, { timeout: 50000 });
// });

// Done

// export const previewSanction = asyncHandler(async (req, res) => {
//   console.log("user intered in preview sanction---->");
//   // Step 1: Fetch user details and validate (keeping existing validation)
//   const user = await prisma.customer.findUnique({
//     where: { id: req.user.id },
//   });
//   if (!user) {
//     throw new ResponseError(400, "User not found");
//   }

//   const lead_detail = await prisma.lead.findFirst({
//     where: { customer_id: user.id },
//     orderBy: { created_at: "desc" },
//   });

//   if (!lead_detail) {
//     throw new ResponseError(400, "Lead not found");
//   }

//   if (lead_detail.is_rejected) {
//     throw new ResponseError(400, "Lead is rejected");
//   }

//   if (lead_detail.is_sanction) {
//     throw new ResponseError(400, "Sanction already completed");
//   }
//   if (!lead_detail.is_kyc_approved) {
//     throw new ResponseError(400, "Verify Your KYC first");
//   }
//   const existingSanction = await prisma.sanction.findFirst({
//     where: { lead_id: lead_detail.id },
//   });

//   if (!existingSanction) {
//     throw new ResponseError(400, "Sanction not found");
//   }
//   // const existingSanction = true;
//   // const lead_detail = true;

//   // Generate PDF content
//   const headerImagePath = path.join(__dirname, '../../public/images/Header.png');
//   const footerImagePath = path.join(__dirname, '../../public/images/Footer.png');
//   const headerImageBase64 = convertImageToBase64(headerImagePath);
//   const footerImageBase64 = convertImageToBase64(footerImagePath);
//   const sanction_html_page = sanctionpage(
//     existingSanction,
//     lead_detail,
//     headerImageBase64,
//     footerImageBase64
//   );

//     // const pdfBuffer = await generatepdf(sanction_html_page, { returnBuffer: true });
//     const pdfBuffer = Buffer.from(sanction_html_page, 'utf-8').toString('base64');
//   console.log(pdfBuffer);

//   // Create a Blod/File from the buffer
//   const pdfFile = new File([pdfBuffer], 'sanction_letter.pdf', { type: 'application/pdf' });
//   // Step 2: Initialize e-Sign session
//   const initEsignPayload = {
//     pdf_pre_uploaded: true,
//     callback_url: "https://www.blinkrloan.com/",
//     config: {
//       skip_otp: true,
//       auth_mode: "1",
//       reason: "Contract",
//       positions: {
//         1: [{ x: 10, y: 20 }]
//       }
//     },
//     prefill_options: {
//       full_name: user.full_name, // lead_detail.full_name,
//       mobile_number: user.mobile, // lead_detail.mobile,
//       user_email: user.personal_email // lead_detail.personal_email
//     }
//   };

//   // Call first API to initialize e-Sign
//   const { apiRequest: initRequest, apiResponse: initResponse } = await esignInitAPI(initEsignPayload);
//   // console.log("initResponse---->", initResponse);
//   // console.log("initRequest---->", initRequest);
//   if (initResponse?.status_code !== 200) {

//     handleThirdPartyResponse(initResponse);
//   }

//   const clientId = initResponse.data.client_id;
//   const esignUrl = initResponse.data.url;
//   // console.log("clientId---->", clientId);
//   // console.log("esignUrl---->", esignUrl);

//   // Step 3: Get upload URL
//   const { apiRequest: uploadUrlRequest, apiResponse: uploadUrlResponse } = await getUploadUrlAPI({ client_id: clientId });
//   // console.log("uploadUrlResponse---->", uploadUrlResponse);
//   // console.log("uploadUrlRequest---->", uploadUrlRequest);
//   if (uploadUrlResponse?.status_code !== 200) {
//     handleThirdPartyResponse(uploadUrlResponse);
//   }

//   // Step 4: Upload PDF to provided S3 URL
//   const uploadUrl = uploadUrlResponse.data.url;
//   const uploadFields = uploadUrlResponse.data.fields;
//   // console.log("uploadUrl---->", uploadUrl);
//   // console.log("uploadFields---->", uploadFields);

//   // if (pdfFile) {
//   //   console.log("pdfFile---->");
//   // }

//   // Step 5: Upload PDF to provided S3 URL
//   const formData = new FormData();
//   Object.entries(uploadFields).forEach(([key, value]) => {
//     formData.append(key, value);
//   });
//   formData.append('file', pdfFile);
//   // Step 6: Upload PDF to provided S3 URL
//   // console.log("formData---->", formData);
//   const uploadResponse = await fetch(uploadUrl, {
//     method: 'POST',
//     body: formData
//   });
//   // console.log("uploadResponse---->", uploadResponse);
//   if (!uploadResponse.ok) {
//     throw new ResponseError(400, "Error from Surepass e-Sign(uploadResponse function in sanction.controller.js) API : Failed to upload document");
//   }

//   // Update database records
//   await prisma.$transaction(async (prisma) => {
//     await prisma.sanction.update({
//       where: { id: existingSanction.id },
//       data: {
//         is_eSign_pending: true,
//         document_id: clientId,
//       },
//     });

//     await prisma.api_Logs.create({
//       data: {
//         pan: user.pan,
//         api_type: API_TYPE.ESIGN_API,
//         api_provider: 1,
//         api_request: initRequest,
//         api_response: initResponse,
//         api_status: true,
//         lead_id: lead_detail.id,
//         customer_id: user.id,
//       },
//     });

//     await prisma.lead.update({
//       where: { id: lead_detail.id },
//       data: {
//         lead_stage: LEAD_STAGE.SANCTION_PENDING,
//       },
//     });

//     await prisma.lead_Logs.create({
//       data: {
//         customer_id: user.id,
//         lead_id: lead_detail.id,
//         pan: user.pan,
//         remarks: "Sending for e-Sign"
//       },
//     });
//   }, { timeout: 30000 });

//   // Return the e-Sign URL to frontend
//   return res.status(200).json({
//     success: true,
//     message: "Sent for e-sign successfully!",
//     document_id: clientId,
//     signUrl: esignUrl,
//   });
// });

export const previewSanction = asyncHandler(async (req, res) => {
  console.log("user intered in preview sanction---->");
  // Step 1: Fetch user details and validate (keeping existing validation)
  const user = await prisma.customer.findUnique({
    where: { id: req.user.id },
  });
  if (!user) {
    throw new ResponseError(400, "User not found");
  }

  const lead_detail = await prisma.lead.findFirst({
    where: { customer_id: user.id },
    orderBy: { created_at: "desc" },
  });

  if (!lead_detail) {
    throw new ResponseError(400, "Lead not found");
  }

  if (lead_detail.is_rejected) {
    throw new ResponseError(400, "Lead is rejected");
  }

  if (lead_detail.is_sanction) {
    throw new ResponseError(400, "Sanction already completed");
  }
  if (!lead_detail.is_kyc_approved) {
    throw new ResponseError(400, "Verify Your KYC first");
  }
  const existingSanction = await prisma.sanction.findFirst({
    where: { lead_id: lead_detail.id },
  });

  if (!existingSanction) {
    throw new ResponseError(400, "Sanction not found");
  }
  const bankDetails = await prisma.bank_Details.findFirst({
    where: {
      pan: lead_detail.pan,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  // Generate PDF content
  const headerImagePath = path.join(
    __dirname,
    "../../public/images/Header.webp"
  );
  const footerImagePath = path.join(
    __dirname,
    "../../public/images/Footer.webp"
  );
  const headerImageBase64 = convertImageToBase64(headerImagePath);
  const footerImageBase64 = convertImageToBase64(footerImagePath);
  const sanction_html_page = sanctionpage(
    existingSanction,
    lead_detail,
    headerImageBase64,
    footerImageBase64,
    lead_detail?.elegible_loan_amount,
    bankDetails?.bank_acc_no,
    user?.address
  );

  console.log("sanction_html_page---->", sanction_html_page);
  const pdfBuffer = await generatepdf(sanction_html_page);
  // const pdfBuffer = Buffer.from(sanction_html_page, 'utf-8').toString('base64');
  // console.log(pdfBuffer);
  // const pdfBuffer = Buffer.from(sanction_html_page, 'utf-8').toString('base64');
  if (!pdfBuffer) {
    return res.status(400).json({ message: "pdfBuffer is not generated" });
  }
  console.log("---------------- PDF BUFFER", pdfBuffer);

  // Create a Blod/File from the buffer
  const pdfFile = new File([pdfBuffer], "sanction_letter.pdf", {
    type: "application/pdf",
  });
  console.log("pdfFile---->", pdfFile);
  // Step 2: Initialize e-Sign session
  const initEsignPayload = {
    pdf_pre_uploaded: true,
    callback_url: "https://fundobaba.com/apply/disbursal/",
    config: {
      skip_otp: true,
      auth_mode: "1",
      reason: "E-Signed Sanction Letter",
      reason: "E-Signed Sanction Letter",
      positions: {
        1: [{ x: 10, y: 20 }],
      },
    },

    prefill_options: {
      full_name: user.full_name, // lead_detail.full_name,
      mobile_number: user.mobile, // lead_detail.mobile,
      user_email: user.personal_email, // lead_detail.personal_email
    },
  };

  // Call first API to initialize e-Sign
  const { apiRequest: initRequest, apiResponse: initResponse } =
    await esignInitAPI(initEsignPayload);
  // console.log("initResponse---->", initResponse);
  // console.log("initRequest---->", initRequest);
  if (initResponse?.status_code !== 200) {
    handleSurepassResponse(initResponse);
  }

  const clientId = initResponse.data.client_id;
  const esignUrl = initResponse.data.url;
  // console.log("clientId---->", clientId);
  // console.log("esignUrl---->", esignUrl);

  console.log("clientId---->", clientId);
  console.log("clientId---->", clientId);
  // Step 3: Get upload URL
  const { apiRequest: uploadUrlRequest, apiResponse: uploadUrlResponse } =
    await getUploadUrlAPI({ client_id: clientId });
  // console.log("uploadUrlResponse---->", uploadUrlResponse);
  // console.log("uploadUrlRequest---->", uploadUrlRequest);
  if (uploadUrlResponse?.status_code != 200) {
    handleSurepassResponse(uploadUrlResponse);
  }

  // Step 4: Upload PDF to provided S3 URL
  const uploadUrl = uploadUrlResponse.data.url;
  const uploadFields = uploadUrlResponse.data.fields;
  console.log("uploadUrl---->", uploadUrl);
  console.log("uploadFields---->", uploadFields);

  if (pdfFile) {
    console.log("pdfFile---->", pdfFile);
  }

  // Step 5: Upload PDF to provided S3 URL
  const formData = new FormData();
  Object.entries(uploadFields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append("file", pdfFile);
  // Step 6: Upload PDF to provided S3 URL
  console.log("formData---->", formData);
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });
  // console.log("uploadResponse---->", uploadResponse);
  if (!uploadResponse.ok) {
    throw new ResponseError(
      400,
      "Error from Surepass e-Sign API : Failed to upload document"
    );
  }

  // Update database records
  await prisma.$transaction(
    async (tx) => {
      await tx.sanction.update({
        where: { id: existingSanction.id },
        data: {
          is_eSign_pending: true,
          document_id: clientId,
        },
      });

      await tx.api_Logs.create({
        data: {
          pan: user.pan,
          api_type: API_TYPE.ESIGN_API,
          api_provider: 1,
          api_request: initRequest,
          api_response: initResponse,
          api_status: true,
          lead_id: lead_detail.id,
          customer_id: user.id,
        },
      });

      await tx.lead.update({
        where: { id: lead_detail.id },
        data: {
          lead_stage: LEAD_STAGE.SANCTION_PENDING,
        },
      });

      await tx.lead_Logs.create({
        data: {
          customer_id: user.id,
          lead_id: lead_detail.id,
          pan: user.pan,
          remarks: "Sending for e-Sign",
        },
      });
    },
    { timeout: 30000 }
  );

  // Return the e-Sign URL to frontend
  console.log("clientId---->", clientId);
  return res.status(200).json({
    success: true,
    message: "Sent for e-sign successfully!",
    document_id: clientId,
    signUrl: esignUrl,
  });
});
export const redirectUrl = asyncHandler(async (req, res) => {
  const userId = req?.user?.id;
  if (!userId) throw new ResponseError(401, "Unauthorized: User ID missing");

  const [user, lead] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: userId },
      select: { id: true, pan: true },
    }),
    prisma.lead.findFirst({
      where: { customer_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        is_rejected: true,
        is_sanction: true,
        is_kyc_approved: true,
      },
    }),
  ]);

  if (!user) throw new ResponseError(404, "User not found");
  if (!lead) throw new ResponseError(404, "No lead found for user");

  // Validation checks
  if (lead.is_rejected) throw new ResponseError(400, "Lead is rejected");
  if (lead.is_sanction)
    throw new ResponseError(400, "Sanction already completed");
  if (!lead.is_kyc_approved)
    throw new ResponseError(400, "Please complete your KYC first");

  // Get pending sanction with document ID
  const pendingSanction = await prisma.sanction.findFirst({
    where: { lead_id: lead.id, is_eSign_pending: true },
    select: { id: true, document_id: true },
  });
  console.log("pendingSanction---->", pendingSanction);

  if (!pendingSanction)
    throw new ResponseError(
      404,
      "No pending e-sign sanction found for this lead"
    );
  if (!pendingSanction.document_id)
    throw new ResponseError(
      422,
      "Sanction record found but missing document ID"
    );
  console.log("pendingSanction.document_id---->", pendingSanction.document_id);
  // External API call
  const { apiRequest, apiResponse } = await getSingedDocUrl(
    pendingSanction.document_id
  );
  if (!apiResponse || apiResponse.status_code !== 200) {
    handleSurepassResponse(apiResponse);
  }
  console.log("apiResponse---->", apiResponse);
  const fileURL = apiResponse?.data?.url;
  if (!fileURL)
    throw new ResponseError(500, "Signed document URL missing in API response");

  // DB Transaction
  await prisma.$transaction(
    async (tx) => {
      const { pan } = user;
      const { id: leadId } = lead;

      await Promise.all([
        tx.api_Logs.create({
          data: {
            pan,
            api_type: API_TYPE.DOWNLOAD_ESIGN,
            api_provider: 1,
            api_request: apiRequest,
            api_response: apiResponse,
            api_status: true,
            lead_id: leadId,
            customer_id: userId,
          },
        }),
        tx.document.create({
          data: {
            pan,
            document_type: DOCUMENT_TYPE.SANCTION_LETTER,
            document_url: fileURL,
            customer_id: userId,
            lead_id: leadId,
          },
        }),
        tx.sanction.update({
          where: { id: pendingSanction.id },
          data: {
            is_eSigned: true,
            is_eSign_pending: false,
          },
        }),
        tx.lead.update({
          where: { id: leadId },
          data: {
            is_sanction: true,
            lead_stage: LEAD_STAGE.SANCTION_COMPLETED,
          },
        }),
        tx.lead_Logs.create({
          data: {
            customer_id: userId,
            lead_id: leadId,
            pan,
            remarks: "SIGNED SANCTION LETTER GENERATED",
          },
        }),
      ]);
    },
    { timeout: 30000 }
  );

  return res.status(200).json({
    success: true,
    message: "Sanction letter generated and saved successfully",
    disburseLoanAmount: pendingSanction.net_disbursal,
    data: { document_url: fileURL },
  });
});

// Disbursed (API)
export const disbursed = asyncHandler(async (req, res) => {
  console.log("Starting disbursed function");

  const result = await prisma.$transaction(
    async (tx) => {
      console.log("Starting transaction");
      // Destructure frequently used values
      const user = await tx.customer.findFirst({
        where: {
          id: req.user.id,
        },
      });
      if (!user) {
        throw new ResponseError(
          400,
          "User not found",
          `User not found with ID ${req.user.id}`
        );
      }

      const lead = await tx.lead.findFirst({
        where: {
          customer_id: user.id,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      if (!lead) {
        // console.log('Lead not found for loan:', lead);
        throw new ResponseError(
          400,
          "Lead not found",
          `No lead found with lead number ${user.customer_no}`
        );
      }
      if (lead.is_rejected) {
        console.log("Lead is rejected:", lead.id);
        throw new ResponseError(
          400,
          "Lead rejected",
          `Lead is rejected with lead number ${lead.lead_no}`
        );
      }
      if (lead.is_disbursed) {
        console.log("Lead already disbursed:", lead.id);
        throw new ResponseError(
          400,
          "Already disbursed",
          `Lead is already disbursed with lead number ${lead.lead_no}`
        );
      }
      if (lead.is_kyc_reject) {
        console.log("Lead KYC rejected:", lead.id);
        throw new ResponseError(
          400,
          "KYC rejected",
          `Lead is KYC rejected with lead number ${lead.lead_no}`
        );
      }

      // Fetch sanction data
      const sanction = await tx.sanction.findUnique({
        where: { loan_no: lead.loan_no },
        select: {
          id: true,
          net_disbursal: true,
          loan_amount: true,
          repayment_date: true,
          repayment_amount: true,
          roi: true,
          tenure: true,
          is_eSigned: true,
          is_rejected: true,
          is_disbursed: true,
        },
      });
      console.log("Sanction found:", sanction);

      // Validate sanction
      if (!sanction) {
        console.log("Sanction not found for loan:", lead);
        throw new ResponseError(
          400,
          "Sanction not found",
          `No sanction found for lead ${lead.lead_no}`
        );
      }
      if (!sanction.is_eSigned) {
        console.log("Sanction not eSigned:", sanction.id);
        throw new ResponseError(
          400,
          "Sanction not eSigned",
          `Sanction not signed for lead ${lead.lead_no}`
        );
      }
      if (sanction.is_rejected) {
        console.log("Sanction rejected:", sanction.id);
        throw new ResponseError(
          400,
          "Sanction rejected",
          `Sanction rejected for lead ${lead.lead_no}`
        );
      }
      // if (sanction.is_disbursed) {
      //   console.log("Sanction already disbursed:", sanction.id);
      //   throw new ResponseError(
      //     400,
      //     "Already disbursed",
      //     `Loan already disbursed`
      //   );
      // }

      // Prepare core data
      const leadId = lead.id;
      const pan = lead.pan;
      const customerId = lead.customer_id;
      const netDisbursal = sanction.net_disbursal;
      // console.log('Core data prepared:', { leadId, pan, customerId, netDisbursal });

      // Check existing disbursal
      console.log("Checking existing disbursal for lead:", leadId);
      const existingDisbursal = await tx.disbursal.findUnique({
        where: { lead_id: leadId },
        select: { id: true, is_disbursed: true, status: true },
      });
      console.log("Existing disbursal:", existingDisbursal);

      if (existingDisbursal?.is_disbursed) {
        console.log("Payment already processed for lead:", leadId);
        throw new ResponseError(
          400,
          "Payment processed",
          `Payment exists for lead ${lead.lead_no}`
        );
      }
      if (existingDisbursal?.status) {
        if (existingDisbursal?.status == "PENDING") {
          throw new ResponseError(
            400,
            "YOUR PAYMENT IS IN PENDING STATE",
            `YOUR PAYMENT IS IN PENDING STATE ${lead.lead_no}`
          );
        }
        if (existingDisbursal?.status == "FAILED") {
          throw new ResponseError(
            400,
            "YOUR PAYMENT IS IN FAILED STATE",
            `YOUR PAYMENT IS IN FAILED STATE ${lead.lead_no}`
          );
        }
      }

      const bank_Details = await tx.bank_Details.findFirst({
        where: {
          pan: user.pan,
        },
        orderBy: {
          created_at: "desc",
        },
      });
      if (!bank_Details?.bank_acc_no) {
        throw new ResponseError(
          400,
          "YOUR bank_acc_no not found in DB ",
          `YOUR bank_acc_no not found in DB ${lead.lead_no}`
        );
      }
      if (!bank_Details?.ifsc_code) {
        throw new ResponseError(
          400,
          "YOUR ifsc_code not found in DB ",
          `YOUR ifsc_code not found in DB ${lead.lead_no}`
        );
      }

      // call the ICICI bank API
      const bank_response = await sendEncryptedRequest(
        bank_Details.bank_acc_no,
        bank_Details.ifsc_code,
        netDisbursal,
        lead
      );
      logger.warn(
        `Auto Disbursal API reponse in Sanction Controller Bank Response: ${JSON.stringify(
          bank_response
        )}`
      );

      if (!bank_response.success) {
        throw new ResponseError(
          400,
          `PAYMENT  ${bank_response.status}  AT BANK RESPONSE`,
          `PAYMENT  ${bank_response.status} AT BANK RESPONSE ${lead.lead_no}`
        );
      }
      logger.warn(
        `Auto Disbursal API reponse in Sanction Controller Sucessfully Execute: `
      );

      // {
      //   "localTxnDtTime": timestamp,
      //   "beneAccNo": beneAccNo,
      //   "beneIFSC": beneIFSC,
      //   "amount": amount,
      //   "tranRefNo": ref_no,
      //   "paymentRef": "IMPSTransferP2A",
      //   "senderName": "UY fincorp",
      //   "mobile": "9896956566",
      //   "retailerCode": "rcode",
      //   "passCode": "0f1f8b6dcebd4e5d89f20a78a06a3c26",
      //   "bcID": "IBCUY01852",
      // };
      // Create disbursal data
      const disbursalData = {
        payable_account: "IBCUY01852",
        payment_mode: "AUTO_DISBURSED",
        amount: netDisbursal,
        disbursal_date: new Date(),
        loan_amount: sanction.loan_amount,
        repayment_date: sanction.repayment_date,
        repayment_amount: sanction.repayment_amount,
        roi: sanction.roi,
        tenure: sanction.tenure,
        // disbursed_by: employeeId,
        // channel: details.channel,
        // remarks: details.remarks,
        pan,
        is_disbursed: true,
        sanction_id: sanction.id,
        loan_no: sanction.loan_no,
      };
      console.log("Disbursal data prepared:", disbursalData);

      // Upsert disbursal record
      console.log("Creating/updating disbursal record");
      const disbursement = existingDisbursal
        ? await tx.disbursal.update({
            where: { id: existingDisbursal.id },
            data: disbursalData,
          })
        : await tx.disbursal.create({
            data: { ...disbursalData, lead_id: leadId },
          });
      console.log("Disbursal record created/updated:", disbursement);

      // Create transaction history
      console.log("Creating transaction history");
      const transactionHistory = await tx.transaction_History.create({
        data: {
          lead_id: leadId,
          loan_no: sanction.loan_no,
          utr: bank_response?.BankRRN,
          payable_account: "IBCUY01852",
          bank_name: "ICICI",
          ifsc: "IFSC",
          payment_mode: "AUTO_DISBURSED",
          disbursal_id: disbursement.id,
          sanction_id: sanction.id,
          amount: netDisbursal,
        },
      });
      console.log("Transaction history created:", transactionHistory);

      // Finalize disbursal
      console.log("Finalizing disbursal");
      await tx.disbursal.update({
        where: { id: disbursement.id },
        data: {
          is_disbursed: true,
          utr: bank_response?.BankRRN,
          transaction_history_id: transactionHistory.id,
        },
      });

      // Parallelize all subsequent operations
      console.log("Starting parallel operations");
      await Promise.all([
        // Collection tracking
        tx.collection
          .create({
            data: {
              customer_id: customerId,
              pan: user.pan,
              lead_id: leadId,
              loan_no: sanction.loan_no,
              received_amount: 0,
              collection_active: true,
            },
          })
          .then(() => console.log("Collection record created")),

        // Payment record
        tx.payment
          .create({
            data: {
              pan: user.pan,
              lead_id: leadId,
              loan_no: sanction.loan_no,
              lead_no: lead.lead_no,
            },
          })
          .then(() => console.log("Payment record created")),

        // Lead status update
        tx.lead
          .update({
            where: { id: leadId },
            data: {
              is_disbursed: true,
              lead_stage: LEAD_STAGE.DISBURSED,
            },
          })
          .then(() => console.log("Lead status updated")),

        tx.api_Logs.create({
          data: {
            pan,
            api_type: "BANK_AUTO_DISBURSAL",
            api_provider: 1,
            api_request: {},
            api_response: bank_response,
            api_status: bank_response?.success,
            customer_id: user.id,
            lead_id: lead.id,
          },
        }),

        // Activity logging
        // tx.employee_Logs.create({
        //   data: {
        //     employee_id: employeeId,
        //     remarks: `${netDisbursal} disbursed to ${loan_no}`
        //   }
        // }).then(() => console.log('Employee log created')),

        tx.lead_Logs
          .create({
            data: {
              customer_id: customerId,
              lead_id: leadId,
              pan: user.pan,
              remarks: `Amount: ${netDisbursal} Disbursed by 999`,
            },
          })
          .then(() => console.log("Lead log created")),
      ]);
      //---------------------------------- Send data to Credgenics ----------------------------------

      await sendDataToCredgenics(sanction.loan_no);
      // console.log("----------->", reponse)
      // if (!reponse?.success) {
      //   throw new ResponseError(400, "Data not sent to Credgenics", `Data not sent to Credgenics for loan ${lead.loan_no}`)
      // }

      // console.log('All parallel operations completed');
    },
    { timeout: 50000 }
  );
  return res.status(200).json({
    message : "Disbursed Sucessfully"
    // disbursement_id: disbursement?.id,
    // loan_no: sanction?.loan_no,
    // amount: netDisbursal,
    // transaction_id: bank_response?.BankRRN,
  });
});

export const getCongratulationPageDetails = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Step 1: Validate user
  const user = await prisma.customer.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new ResponseError(404, "User not found");
  }

  // Step 2: Get most recent lead
  const lead = await prisma.lead.findFirst({
    where: { customer_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      is_rejected: true,
      is_sanction: true,
      is_disbursed: true,
    },
  });

  if (!lead) {
    throw new ResponseError(404, "No lead found for user");
  }

  // Step 3: Business rule validations
  if (lead.is_rejected) {
    throw new ResponseError(400, "Lead is rejected");
  }
  if (!lead.is_sanction) {
    throw new ResponseError(400, "Sanction not completed");
  }
  // if (!lead.is_disbursed) {
  //   throw new ResponseError(400, "Loan is not disbursed");
  // }

  // Step 4: Fetch bank & sanction details in parallel
  const [bankDetails, sanctionDetails] = await Promise.all([
    prisma.bank_Details.findFirst({
      where: { customer_id: userId },
      orderBy: { created_at: "desc" },
      select: { bank_acc_no: true },
    }),
    prisma.sanction.findFirst({
      where: { lead_id: lead.id },
      select: { net_disbursal: true },
    }),
  ]);

  // Step 5: Mask account number safely
  const maskAccountNumber = (accNo = "") => {
    if (typeof accNo !== "string" || accNo.length < 4) return accNo;
    return accNo.slice(-4).padStart(accNo.length, "X");
  };

  const responseData = {
    amount_disbursed: sanctionDetails?.net_disbursal || 0,
    masked_bank_no: maskAccountNumber(bankDetails?.bank_acc_no || ""),
  };

  // Step 6: Respond
  res.status(200).json({
    success: true,
    message: "Congratulations! Loan disbursed successfully.",
    data: responseData,
  });
});

// Done
