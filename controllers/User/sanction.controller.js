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
import { handleSurepassResponse, handleThirdPartyResponse } from "../../utils/apiResponse.js";
import { uploadSanctionLetterS3 } from "../../utils/uploadSanction.js";
import {
  API_TYPE,
  DOCUMENT_TYPE,
  LEAD_STAGE,
} from "../../constants/constants.js";
import { ResponseError } from "../../utils/responseError.js";
import path from "path";
import convertImageToBase64 from "../../utils/imageToBase64.js";
import { fileURLToPath } from 'url';
import { calculateRepaymentDate } from "../../utils/calculateTenure.js";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const getLoanDetails = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  // Cache lead details with minimal fields
  const lead = await prisma.lead.findFirst({
    where: { customer_id: customerId },
    orderBy: { created_at: "desc" },
    select: { id: true, is_rejected: true }
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
        repayment_amount: true
      }
    }),
    prisma.bank_Details.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: "desc" },
      select: { bank_acc_no: true }
    })
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
    masked_bank_no: bank.bank_acc_no.slice(-4).padStart(bank.bank_acc_no.length, 'X')
  };

  return res.status(200).json({
    message: "Loan details fetched successfully",
    data: response
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

  // Generate PDF content
  const headerImagePath = path.join(__dirname, '../../public/images/Header.png');
  const footerImagePath = path.join(__dirname, '../../public/images/Footer.png');
  const headerImageBase64 = convertImageToBase64(headerImagePath);
  const footerImageBase64 = convertImageToBase64(footerImagePath);
  const sanction_html_page = sanctionpage(
    existingSanction,
    lead_detail,
    headerImageBase64,
    footerImageBase64
  );

  console.log("sanction_html_page---->", sanction_html_page);
  const pdfBuffer = await generatepdf(sanction_html_page);
  // const pdfBuffer = Buffer.from(sanction_html_page, 'utf-8').toString('base64');
  // console.log(pdfBuffer);
  // const pdfBuffer = Buffer.from(sanction_html_page, 'utf-8').toString('base64');
  if (!pdfBuffer) {
    return res.status(400).json({ message: "pdfBuffer is not generated" })
  }
  console.log("---------------- PDF BUFFER", pdfBuffer);

  // Create a Blod/File from the buffer
  const pdfFile = new File([pdfBuffer], 'sanction_letter.pdf', { type: 'application/pdf' });
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
        1: [{ x: 10, y: 20 }]
      }
    },

    prefill_options: {
      full_name: user.full_name, // lead_detail.full_name,
      mobile_number: user.mobile, // lead_detail.mobile,
      user_email: user.personal_email // lead_detail.personal_email
    }
  };

  // Call first API to initialize e-Sign
  const { apiRequest: initRequest, apiResponse: initResponse } = await esignInitAPI(initEsignPayload);
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
  const { apiRequest: uploadUrlRequest, apiResponse: uploadUrlResponse } = await getUploadUrlAPI({ client_id: clientId });
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
  formData.append('file', pdfFile);
  // Step 6: Upload PDF to provided S3 URL
  console.log("formData---->", formData);
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });
  // console.log("uploadResponse---->", uploadResponse);
  if (!uploadResponse.ok) {
    throw new ResponseError(400, "Error from Surepass e-Sign API : Failed to upload document");
  }

  // Update database records
  await prisma.$transaction(async (tx) => {
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
  }, { timeout: 30000 });

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
      select: { id: true, pan: true }
    }),
    prisma.lead.findFirst({
      where: { customer_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        is_rejected: true,
        is_sanction: true,
        is_kyc_approved: true
      }
    })
  ]);

  if (!user) throw new ResponseError(404, "User not found");
  if (!lead) throw new ResponseError(404, "No lead found for user");

  // Validation checks
  if (lead.is_rejected) throw new ResponseError(400, "Lead is rejected");
  if (lead.is_sanction) throw new ResponseError(400, "Sanction already completed");
  if (!lead.is_kyc_approved) throw new ResponseError(400, "Please complete your KYC first");

  // Get pending sanction with document ID
  const pendingSanction = await prisma.sanction.findFirst({
    where: { lead_id: lead.id, is_eSign_pending: true },
    select: { id: true, document_id: true }
  });
  console.log("pendingSanction---->", pendingSanction);

  if (!pendingSanction) throw new ResponseError(404, "No pending e-sign sanction found for this lead");
  if (!pendingSanction.document_id) throw new ResponseError(422, "Sanction record found but missing document ID");
  console.log("pendingSanction.document_id---->", pendingSanction.document_id);
  // External API call
  const { apiRequest, apiResponse } = await getSingedDocUrl(pendingSanction.document_id);
  if (!apiResponse || apiResponse.status_code !== 200) {
    handleSurepassResponse(apiResponse);
  }
  console.log("apiResponse---->", apiResponse);
  const fileURL = apiResponse?.data?.url;
  if (!fileURL) throw new ResponseError(500, "Signed document URL missing in API response");

  // DB Transaction
  await prisma.$transaction(async (tx) => {
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
          customer_id: userId
        }
      }),
      tx.document.create({
        data: {
          pan,
          document_type: DOCUMENT_TYPE.SANCTION_LETTER,
          document_url: fileURL,
          customer_id: userId,
          lead_id: leadId
        }
      }),
      tx.sanction.update({
        where: { id: pendingSanction.id },
        data: {
          is_eSigned: true,
          is_eSign_pending: false
        }
      }),
      tx.lead.update({
        where: { id: leadId },
        data: {
          is_sanction: true,
          lead_stage: LEAD_STAGE.SANCTION_COMPLETED
        }
      }),
      tx.lead_Logs.create({
        data: {
          customer_id: userId,
          lead_id: leadId,
          pan,
          remarks: "SIGNED SANCTION LETTER GENERATED"
        }
      })
    ]);
  }, { timeout: 30000 });

  return res.status(200).json({
    success: true,
    message: "Sanction letter generated and saved successfully",
    disburseLoanAmount: pendingSanction.net_disbursal,
    data: { document_url: fileURL }
  });
});

// Done
// export const disbursed = asyncHandler(async (req, res) => {
//   // Use transaction for all database operations

//   const user = await tx.customer.findUnique({
//     where: { id: req.user.id },
//   });

//   if (!user) throw new ResponseError(400, "User not found");

//   const lead = await tx.lead.findFirst({
//     where: { customer_id: user.id },
//     orderBy: { created_at: "desc" },
//   });

//   if (!lead) throw new ResponseError(400, "No lead found for this user");
//   if (lead.is_rejected) throw new ResponseError(400, "Lead is rejected");

//   const sanction_Information = await tx.sanction.findFirst({
//     where: { lead_id: lead.id },
//   });

//   if (lead.is_disbursed)
//     throw new ResponseError(400, "Loan is already disbursed");
//   if (lead.is_kyc_reject) throw new ResponseError(400, "Kyc is rejected");
//   if (sanction_Information.is_eSign_pending)
//     throw new ResponseError(400, "E-sign is pending");
//   if (sanction_Information.is_rejected)
//     throw new ResponseError(400, "Loan is already rejected");
//   if (sanction_Information.is_disbursed)
//     throw new ResponseError(400, "Loan is already disbursed");

//   const existingDisbursal = await tx.disbursal.findFirst({
//     where: { lead_id: lead.id },
//   });

//   if (existingDisbursal?.is_disbursed)
//     throw new ResponseError(400, "Payment already processed for this lead");

//   const sanction = await tx.sanction.findFirst({
//     where: {
//       lead_id: lead.id,
//       is_eSigned: true,
//     },
//   });

//   if (!sanction)
//     throw new ResponseError(400, "No sanction found for this lead");

//   let disbursement;

//   await prisma.$transaction(async (tx) => {
//     if (existingDisbursal && !existingDisbursal.is_disbursed) {
//       disbursement = await tx.disbursal.update({
//         where: { id: existingDisbursal.id },
//         data: {
//           payable_account: "04652151000852",
//           payment_mode: "BANK_TRANSFER",
//           amount: sanction.net_disbursal,
//           disbursal_date: new Date(),
//           loan_amount: sanction.loan_amount,
//           repayment_date: sanction.repayment_date,
//           repayment_amount: sanction.repayment_amount,
//           roi: sanction.roi,
//           tenure: sanction.tenure,
//           is_rejected: false,
//           rejected_by: null,
//         },
//       });
//     } else {
//       disbursement = await tx.disbursal.create({
//         data: {
//           // lead_id: lead.id,
//           lead: {
//             connect: { id: lead.id },
//           },
//           pan: user.pan,
//           sanction_id: sanction.id,
//           loan_no: sanction.loan_no,
//           payable_account: "04652151000852",
//           payment_mode: "BANK_TRANSFER",
//           amount: sanction.net_disbursal,
//           disbursal_date: new Date(),
//           loan_amount: sanction.loan_amount,
//           repayment_date: sanction.repayment_date,
//           repayment_amount: sanction.repayment_amount || 5000,
//           roi: sanction.roi,
//           tenure: sanction.tenure,
//         },
//       });
//     }

//     // this data come from bank table 
//     const { apiResponse, apiRequest } = await disburseLoanAPI({
//       account_number: "04652151000285",
//       ifsc: "IFSC0465",
//       amount: sanction.net_disbursal,
//       customer_name: user.full_name,
//       loan_no: sanction.loan_no,
//       pan: user.pan,
//     });

//     await tx.api_Logs.create({
//       data: {
//         pan: user.pan,
//         api_type: API_TYPE.LOAN_DISBURSEMENT,
//         api_provider: 1,
//         api_request: apiRequest || null,
//         api_response: apiResponse || null,
//         api_status: apiResponse?.payment_status === "SUCCESS",
//         lead_id: lead.id,
//         customer_id: user.id,
//       },
//     });

//     const transactionHistory = await tx.transaction_History.create({
//       data: {
//         lead_id: lead.id,
//         loan_no: sanction.loan_no,
//         utr: apiResponse.transaction_id,
//         disbursal_id: disbursement.id,
//         sanction_id: sanction.id,
//         amount: sanction.net_disbursal,
//         transaction_response: apiResponse,
//       },
//     });

//     if (apiResponse?.payment_status === "SUCCESS") {
//       await tx.disbursal.update({
//         where: { id: disbursement.id },
//         data: {
//           is_disbursed: true,
//           utr: apiResponse.transaction_id,
//           transaction_history_id: transactionHistory.id,
//         },
//       });

//       await tx.collection.create({
//         data: {
//           customer_id: user.id,
//           pan: user.pan,
//           lead_id: lead.id,
//           loan_no: sanction.loan_no,
//           payment_mode: "BANK_TRANSFER",
//           received_amount: 0,
//           repayment_type: "DISBURSEMENT",
//           date_of_recived: new Date(),
//           payment_verification: 1,
//           collection_active: true,
//           remarks: "Initial loan disbursement",
//         },
//       });

//       await tx.lead.update({
//         where: { id: lead.id },
//         data: {
//           is_disbursed: true,
//           lead_stage: LEAD_STAGE.DISBURSED,
//         },
//       });

//       // add lead log
//       await tx.lead_Logs.create({
//         data: {
//           customer_id: user.id,
//           lead_id: lead.id,
//           pan: user.pan,
//           remarks: "Loan disbursed successfully",
//         },
//       });
//       return {
//         success: true,
//         message: "Loan disbursed successfully",
//         data: {
//           disbursement_id: disbursement.id,
//           loan_no: disbursement.loan_no,
//           amount: disbursement.amount,
//           transaction_id: apiResponse.transaction_id,
//         },
//       };
//     } else {
//       await tx.disbursal.update({
//         where: { id: disbursement.id },
//         data: {
//           is_rejected: true,
//           rejected_by: 999,
//         },
//       });
//       // update lead log on failure status
//       await tx.lead_Logs.create({
//         data: {
//           customer_id: user.id,
//           lead_id: lead.id,
//           pan: user.pan,
//           remarks: "Loan disbursement failed",
//         },
//       });

//       await tx.lead.update({
//         where: { id: lead.id },
//         data: {
//           is_disbursed: false,
//           is_rejected: true,
//           rejected_by: 999,
//           rejection_remarks: apiResponse?.message || "Loan disbursement failed",
//           lead_stage: LEAD_STAGE.DISBURSAL_FAILED,
//         },
//       });

//       throw new ResponseError(
//         400,
//         apiResponse?.message || "Loan disbursement failed"
//       );
//     }
//   }, { timeout: 50000 });

//   // Return success response outside transaction
//   return res.status(200).json({ message: "amount disbursed sucessfully" });
// });


export const getCongratulationPageDetails = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Step 1: Validate user
  const user = await prisma.customer.findUnique({
    where: { id: userId },
    select: { id: true }
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
      is_disbursed: true
    }
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
      select: { bank_acc_no: true }
    }),
    prisma.sanction.findFirst({
      where: { lead_id: lead.id },
      select: { net_disbursal: true }
    })
  ]);

  // Step 5: Mask account number safely
  const maskAccountNumber = (accNo = '') => {
    if (typeof accNo !== 'string' || accNo.length < 4) return accNo;
    return accNo.slice(-4).padStart(accNo.length, 'X');
  };

  const responseData = {
    amount_disbursed: sanctionDetails?.net_disbursal || 0,
    masked_bank_no: maskAccountNumber(bankDetails?.bank_acc_no || '')
  };

  // Step 6: Respond
  res.status(200).json({
    success: true,
    message: "Congratulations! Loan disbursed successfully.",
    data: responseData
  });
});



// Done
