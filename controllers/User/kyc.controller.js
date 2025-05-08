import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import asyncHandler from "../../utils/asyncHandler.js";
import { handleThirdPartyResponse, handleSurepassResponse } from "../../utils/apiResponse.js";
import { uploadSanctionLetterS3 } from "../../utils/uploadSanction.js";
import { ADDRESS_SOURCE, API_TYPE, COUNTRY, DOCUMENT_TYPE, LEAD_STAGE } from "../../constants/constants.js";
import { ResponseError } from '../../utils/responseError.js'
import { addressFormatter } from "../../utils/addressFormatter.js"
import _ from 'lodash';

dotenv.config();
import {
  sendAadhaarOtpAPISurePass,
  validateAadhaarOtpAPIsurepass,
} from "../../service/thirdParty.js";
import { validatePANwithAadhaar } from "../../utils/aadhaarPANvalidation.js";
const prisma = new PrismaClient();

//---------------------------------------------- Perfios ---------->
// const Initiatekyc = asyncHandler(async (req, res) => {
//   const { aadhaarNo } = req.body;
//   const aadhaarRegex = /^[2-9]{1}[0-9]{11}$/;
//   if (!aadhaarNo) {
//     throw new ResponseError(400, "Please provide Aadhaar Number")
//   }

//   if (!aadhaarRegex.test(aadhaarNo)) {
//     throw new ResponseError(400, "Invalid Aadhaar format")
//   }

//   const user_id = req.user.id;
//   const user = await prisma.customer.findUnique({
//     where: { id: user_id },
//   });

//   const lead = await prisma.lead.findFirst({
//     where: { customer_id: user.id },
//     orderBy: { created_at: "desc" },
//   });
//   if (lead.is_rejected) {
//     throw new ResponseError(400, "Your Lead is rejected")
//   }

//   if (!lead.is_loan_requested) {
//     throw new ResponseError(400, "Please request your loan first")
//   }
//   if (lead.is_kyc_approved) {
//     throw new ResponseError(400, "Your KYC is already approved")
//   }
//   // call send aadhaar OTP API
//   const otpResponse = await sendAadhaarOtpAPI(aadhaarNo);

//   if (otpResponse?.statusCode != '101') {
//     handleThirdPartyResponse(otpResponse);
//   }

//   // console.log("widiqdvuqidv------------->", otpResponse)

//   prisma.$transaction(async (prisma) => {

//     await prisma.lead.update({
//       where: { id: lead.id },
//       data: { lead_stage: LEAD_STAGE.SEND_AADHAAR_OTP },
//     }),
//       await prisma.lead_Logs.create({
//         data: {
//           customer_id: user.id,
//           lead_id: lead.id,
//           pan: user.pan,
//           remarks: "Send Aadhaar OTP",
//         },
//       })

//     return res.status(200).json({
//       aadhaarNo: aadhaarNo,
//       // accessKey: 'vfajfgk',
//       accessKey: otpResponse?.requestId || '',
//       message: "OTP sent successfully",
//     });

//   }, { timeout: 30000 })

// });
// const submitotp = asyncHandler(async (req, res) => {
//   const { otp, accessKey, aadhaarNo } = req.body;

//   if (!otp || !accessKey || !aadhaarNo) {
//     throw new ResponseError(400, "Missing required fields")
//   }

//   const { aadhaarRequest, aadhaarResponse } = await validateAadhaarOtpAPI(
//     otp,
//     accessKey,
//     aadhaarNo,
//   );
//   // console.log("aadhaarResponse-->", aadhaarResponse)

//   if (aadhaarResponse?.statusCode != '101') {
//     handleThirdPartyResponse(aadhaarResponse);
//   }

//   // lead logs
//   await prisma.$transaction(async (prisma) => {
//     const user_id = req.user.id;
//     const user = await prisma.customer.findUnique({
//       where: { id: user_id },
//     });

//     const lead = await prisma.lead.findFirst({
//       where: { customer_id: user.id },
//       orderBy: { created_at: "desc" },
//     });
//     if (lead.is_rejected) {
//       throw new ResponseError(400, "Your Lead is rejected")
//     }

//     if (lead.is_kyc_approved) {
//       throw new ResponseError(400, "Your KYC is already approved")
//     }
//     //upload aadhaar image to S3
//     const base64Image = aadhaarResponse?.result?.dataFromAadhaar?.image;
//     console.log("base64Image -----", base64Image);
//     const ImageName = `aadhaar_img-${Date.now()}`

//     const imgUrl = await uploadSanctionLetterS3(base64Image, user.pan, ImageName, 'image/jpeg');
//     console.log("aadhar image uploaded !!");

//     //upload aadhar file to S3
//     // const base64File = aadhaarResponse?.result?.dataFromAadhaar?.file?.pdfContent;
//     // console.log("base64File-----", base64File);
//     // const fileName = `aadhaar_file-${Date.now()}.pdf`

//     // const fileUrl = uploadSanctionLetterS3(base64File, user.pan, fileName);
//     // console.log("aadhaar image  uploaded!!");

//     await prisma.document.create({
//       data: {
//         pan: user.pan,
//         document_type: DOCUMENT_TYPE.AADHAAR_IMAGE,
//         document_url: imgUrl,
//         customer_id: user.id ?? null,
//         lead_id: lead.id ?? null,
//         remarks: 'Aadhaar image uploaded to S3 automatically'
//       }
//     });

//     // await prisma.document.create({
//     //   data: {
//     //     pan: user.pan,
//     //     document_type: DOCUMENT_TYPE.AADHAAR,
//     //     document_url: fileUrl,
//     //     customer_id: user.id ?? null,
//     //     lead_id: lead.id ?? null,
//     //     remarks: 'Aadhaar file uploaded to S3 automatically'
//     //   }
//     // });


//     // 1. save aadhar in api_logs
//     const {
//       result: {
//         dataFromAadhaar: { image, file, ...dataWithoutImageFile },
//         ...restResult
//       },
//       ...rest
//     } = aadhaarResponse;

//     const updatedJson = {
//       ...rest,
//       result: {
//         ...restResult,
//         dataFromAadhaar: dataWithoutImageFile
//       }
//     };

//     // console.log(updatedJson)

//     const aadharDetails = await prisma.api_Logs.create({
//       data: {
//         pan: user.pan,
//         customer_id: user.id,
//         lead_id: lead.id,
//         api_type: API_TYPE.AADHAAR_KYC,
//         api_provider: 1,
//         api_request: aadhaarRequest || null,
//         api_response: updatedJson || null,
//         api_status: true,
//       },
//     });

//     const panDetails = await prisma.api_Logs.findFirst({
//       where: {
//         api_type: API_TYPE.PAN_DETAILS,
//         pan: user.pan,
//       },
//     });
//     // const bankDetails = await prisma.bank_Details.findFirst({
//     //   where: { pan: user.pan },
//     //   orderBy: {
//     //     created_at: "desc"
//     //   }
//     // });

//     // extract address from aadhaar and set in customer and lead table
//     await prisma.customer.update({
//       where: { id: user.id },
//       data: {
//         aadhaar: aadhaarNo,
//         address: aadhaarResponse?.result?.dataFromAadhaar?.address?.combinedAddress || "",
//         state:
//           aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress?.state || "",
//         country: COUNTRY.INDIA,
//         pincode:
//           aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress?.pincode || "",
//         city: aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress
//           ?.district || "",
//       },
//     });
//     await prisma.lead.update({
//       where: { id: lead.id },
//       data: {
//         aadhaar: aadhaarNo,
//         // address: aadharDetails?.api_response?.result?.address?.combinedAddress,
//         // state:
//         //   aadharDetails?.api_response?.result?.address?.splitAddress?.state,
//         // country:
//         //   aadharDetails?.api_response?.result?.address?.splitAddress?.country,
//         // pincode: Number(
//         //   aadharDetails?.api_response?.result?.address?.splitAddress?.pincode
//         // ),
//         // city: aadharDetails?.api_response?.result?.address?.splitAddress
//         //   ?.district,
//       },
//     });
//     // save this address in address table 
//     await prisma.customer_address.create({
//       data: {
//         customer_id: user.id,
//         lead_id: lead.id,
//         pan: user.pan,
//         address_source: ADDRESS_SOURCE.AADHAAR,
//         address: aadhaarResponse?.result?.dataFromAadhaar?.address?.combinedAddress || "",
//         city: aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress
//           ?.district || "",
//         state: aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress?.state || "",
//         pincode: aadhaarResponse?.result?.dataFromAadhaar?.address?.splitAddress?.pincode || "",
//         country: COUNTRY.INDIA
//       },
//     });

//     // 2. match aadhar details with PAN
//     const validateData = validatePANwithAadhaar(
//       aadharDetails.api_response,
//       panDetails.api_response,
//     );
//     // const validateData = validatePANwithAadhaar(
//     //   aadharDetails.api_response,
//     //   panDetails.api_response,
//     //   bankDetails
//     // );
//     console.log("validation-->", validateData)
//     if (!validateData?.isValid) {
//       const remarksData = validateData.isValid
//         ? "Aadhaar KYC successfully completed"
//         : `Mismatch: ${validateData.mismatchReasons.join(", ")}`;

//       await prisma.lead_Logs.create({
//         data: {
//           customer_id: user.id,
//           lead_id: lead.id,
//           pan: user.pan,
//           remarks: remarksData, // Short message
//         },
//       });

//       await prisma.lead.update({
//         where: { id: lead.id },
//         data: { is_kyc_reject: true, kyc_rejected_by: 999, lead_stage: LEAD_STAGE.REJECT_AADHAR_KYC },
//       });
//       // update status pending (in lead)
//       return res
//         .status(400)
//         .json({ error: "Aadhaar and PAN details does not match" });
//     }
//     console.log("Validate Data -->", validateData);

//     // update lead status ekyc -> verified
//     await prisma.lead.update({
//       where: { id: lead.id },
//       data: { is_kyc_approved: true, lead_stage: LEAD_STAGE.VERIFY_AADHAAR_KYC },
//     });

//     await prisma.lead_Logs.create({
//       data: {
//         customer_id: user.id,
//         lead_id: lead.id,
//         pan: user.pan,
//         remarks: "Aadhaar KYC sucessfully complete",
//       },
//     });

//     res.status(200).json({ message: "Aadhaar E-KYC successfully completed" });
//   }, { timeout: 30000 });
// });
//------------------------------------------------------------------>



//------------------------------------------------ Sucrepass --------->
const aadhaarRegex = /^[2-9]{1}[0-9]{11}$/;

const Initiatekyc = asyncHandler(async (req, res) => {
  const { aadhaarNo } = req.body;
  const userId = req.user.id;

  // // Validation checks
  if (!aadhaarNo) throw new ResponseError(400, "Please provide Aadhaar Number");
  if (!aadhaarRegex.test(aadhaarNo)) throw new ResponseError(400, "Invalid Aadhaar format");

  // // Parallel data fetching
  const [user, lead] = await Promise.all([
    prisma.customer.findUnique({ where: { id: userId } }),
    prisma.lead.findFirst({
      where: { customer_id: userId },
      orderBy: { created_at: "desc" },
    })
  ]);

  // Lead validation checks
  if (lead.is_rejected) throw new ResponseError(400, "Your Lead is rejected");
  if (!lead.is_loan_requested) throw new ResponseError(400, "Please request your loan first");
  if (lead.is_kyc_approved) throw new ResponseError(400, "Your KYC is already approved");

  console.log("aadhaarNo---->KYC CALL", aadhaarNo)
  // API call
  const otpResponse = await sendAadhaarOtpAPISurePass(aadhaarNo);
  console.log("otpResponse---->", otpResponse?.status_code)
  if (otpResponse?.status_code != '200') handleSurepassResponse(otpResponse);

  // Transaction block
  await prisma.$transaction(async (prisma) => {
    await Promise.all([
      prisma.lead.update({
        where: { id: lead.id },
        data: { lead_stage: LEAD_STAGE.SEND_AADHAAR_OTP }
      }),
      prisma.lead_Logs.create({
        data: {
          customer_id: user.id,
          lead_id: lead.id,
          pan: user.pan,
          remarks: "Send Aadhaar OTP",
        }
      })
    ]);

    res.status(200).json({
      aadhaarNo,
      accessKey: otpResponse?.data?.client_id,
      message: "OTP sent successfully",
    });
  }, { timeout: 30000 });
});

const submitotp = asyncHandler(async (req, res) => {
  const { otp, accessKey, aadhaarNo } = req.body;
  if (!otp || !accessKey) throw new ResponseError(400, "Missing required fields");

  const { aadhaarRequest, aadhaarResponse } = await validateAadhaarOtpAPIsurepass(otp, accessKey);
  if (aadhaarResponse?.status_code != '200') handleSurepassResponse(aadhaarResponse);

  await prisma.$transaction(async (prisma) => {
    // Cache frequently used values
    const userId = req.user.id;
    const user = await prisma.customer.findUnique({ where: { id: userId } });
    const lead = await prisma.lead.findFirst({
      where: { customer_id: userId },
      orderBy: { created_at: "desc" },
    });

    // Early validation checks
    if (lead.is_rejected) throw new ResponseError(400, "Your Lead is rejected");
    if (lead.is_kyc_approved) throw new ResponseError(400, "Your KYC is already approved");

    // Cache common values
    const pan = user.pan;
    const leadId = lead.id;
    const aadhaarData = aadhaarResponse.data;

    // Image upload and document creation
    const base64Image = aadhaarData?.profile_image;
    const imgUrl = await uploadSanctionLetterS3(
      base64Image,
      pan,
      `aadhaar_img-${Date.now()}`,
      'image/jpeg'
    );

    // Prepare common address data
    const formattedAddress = addressFormatter(aadhaarData.address);
    const addressData = {
      state: aadhaarData.address?.state || "",
      country: COUNTRY.INDIA,
      pincode: aadhaarData.zip || "",
      city: aadhaarData.address?.dist || "",
    };

    // Parallel database operations
    const [aadharDetails] = await Promise.all([
      prisma.api_Logs.create({
        data: {
          pan,
          customer_id: userId,
          lead_id: leadId,
          api_type: API_TYPE.AADHAAR_KYC,
          api_provider: 1,
          api_request: aadhaarRequest,
          api_response: { ...aadhaarResponse, data: _.omit(aadhaarData, 'profile_image') },
          api_status: true,
        },
      }),
      prisma.document.create({
        data: {
          pan,
          document_type: DOCUMENT_TYPE.AADHAAR_IMAGE,
          document_url: imgUrl,
          customer_id: userId,
          lead_id: leadId,
          remarks: 'Aadhaar image uploaded to S3 automatically'
        }
      }),
      prisma.customer.update({
        where: { id: userId },
        data: { aadhaar: aadhaarNo, address: formattedAddress, ...addressData }
      }),
      prisma.lead.update({
        where: { id: leadId },
        data: { aadhaar: aadhaarNo }
      }),
      prisma.customer_address.create({
        data: {
          customer_id: userId,
          lead_id: leadId,
          pan,
          address_source: ADDRESS_SOURCE.AADHAAR,
          address: formattedAddress,
          ...addressData
        }
      })
    ]);

    // Parallel data fetching
    const [panDetails, bankDetails] = await Promise.all([
      prisma.api_Logs.findFirst({
        where: { api_type: API_TYPE.PAN_DETAILS, pan }
      }),
      prisma.bank_Details.findFirst({
        where: { pan },
        orderBy: { created_at: "desc" }
      })
    ]);

    // const bankDummyData = { beneficiary_name: "Mr. Uvesh" }
    console.log("panDetails.api_response, aadharDetails.api_response", panDetails.api_response, aadharDetails.api_response, bankDetails);
    // Validation logic
    const validateData = validatePANwithAadhaar(panDetails.api_response, aadharDetails.api_response, bankDetails);
    if (!validateData.isValid) {
      await Promise.all([
        prisma.lead_Logs.create({
          data: {
            customer_id: userId,
            lead_id: leadId,
            pan,
            remarks: `Mismatch: ${validateData.mismatchReasons.join(", ")}`
          }
        }),
        prisma.lead.update({
          where: { id: leadId },
          data: {
            is_kyc_reject: true,
            kyc_rejected_by: 999,
            lead_stage: LEAD_STAGE.REJECT_AADHAR_KYC
          }
        })
      ]);
      return res.status(400).json({ error: "Aadhaar and PAN details does not match" });
    }

    // Final success updates
    await Promise.all([
      prisma.lead.update({
        where: { id: leadId },
        data: { is_kyc_approved: true, lead_stage: LEAD_STAGE.VERIFY_AADHAAR_KYC }
      }),
      prisma.lead_Logs.create({
        data: {
          customer_id: userId,
          lead_id: leadId,
          pan,
          remarks: `Aadhaar KYC successfully completed ${validateData?.nameMatchScore}`
        }
      })
    ]);

    res.status(200).json({ message: "Aadhaar E-KYC successfully completed" });
  }, { timeout: 30000 });
});

export { Initiatekyc, submitotp };
