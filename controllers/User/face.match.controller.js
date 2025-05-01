import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import FormData from "form-data";
import fetch from "node-fetch";
import { API_PATHS } from "../../constants/urlConstants.js";
import { ResponseError } from "../../utils/responseError.js";
import { generatePresignedUrl } from "../../utils/presignedURL.js";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Fix __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Improved downloadImage function with better error handling
const downloadImage = async (url, filepath) => {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    throw new Error("Error downloading image: " + error.message);
  }
};

export const faceMatchHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { files } = req;

    // Validate selfie image
    if (!files || !files.selfie_image1) {
      console.warn("Selfie image is missing");
      return res.status(400).json({
        success: false,
        message: "Selfie image is required",
      });
    }

    // Fetch user and lead details
    const [user, lead] = await Promise.all([
      prisma.customer.findUnique({ where: { id: userId } }),
      prisma.lead.findFirst({
        where: { customer_id: userId },
        orderBy: { created_at: "desc" },
      }),
    ]);

    if (!user?.pan) {
      console.warn(`PAN not found for user ID ${userId}`);
      return res.status(400).json({
        success: false,
        message: "PAN not found for the requested user",
      });
    }

    if (!lead) throw new ResponseError(404, "Lead not found for the user");
    if (lead.is_rejected) throw new ResponseError(400, "Your lead is rejected");
    if (!lead.is_loan_requested)
      throw new ResponseError(400, "Please request your loan first");

    // Aadhaar document fetch
    const documentRecord = await prisma.document.findFirst({
      where: { pan: user.pan, document_type: "AADHAAR_IMAGE" },
    });

    if (!documentRecord?.document_url) {
      console.warn("Aadhaar document not found in DB");
      return res.status(404).json({
        success: false,
        message: "Aadhaar document not found for the given PAN",
      });
    }

    // Generate signed URL & download Aadhaar
    const signedUrl = await generatePresignedUrl(documentRecord.document_url);
    // const localPath = path.join(__dirname, `${user?.pan}.jpeg`);
    console.log("______________", signedUrl);
    // await downloadImage(signedUrl, localPath); // Wait for image download
    // console.log("✅ Image downloaded successfully:", localPath);
    // const aadhaarResponse = await axios.get(signedUrl, {
    //   responseType: "arraybuffer",
    // });
    // const aadhaarBuffer = Buffer.from(aadhaarResponse.data);

    // const fileType = await fileTypeFromBuffer(aadhaarBuffer);

    // Prepare FormData for API request
    // const selfieFile = files.selfie_image1;
    // const formData = new FormData();
    // formData.append("selfie", selfieFile.data, {
    //   filename: selfieFile.name || "selfie.jpg",
    //   contentType: selfieFile.mimetype || "image/jpeg",
    // });

    // formData.append("id_card", aadhaarBuffer, {
    //   filename: `${user.pan}.${fileType.ext}`,
    //   contentType: fileType.mime,
    // });

    // console.log("______________________________",formData);
    // Call Surepass API with async/await
    // const { data: apiResponse } = await axios.post(
    //   API_PATHS.FACEMATCH_URL,
    //   formData,
    //   {
    //     maxBodyLength: Infinity,
    //     headers: {
    //       Authorization: `Bearer ${process.env.FACE_API_TOKEN}`,
    //       ...formData.getHeaders(),
    //     },
    //   }
    // );

    // console.log("✅ Surepass API response:", apiResponse);

    // Handle response status for face match validation
    // if (apiResponse.status === 422) {
    //   console.error("❌ Face validation failed: ", apiResponse);
    //   return res.status(422).json({
    //     success: false,
    //     message: "Face does not match with Aadhaar person.",
    //     error: apiResponse,
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: "Face match processed successfully",
      // data: apiResponse,
    });
  } catch (error) {
    console.error("❌ Face match handler error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// import { PrismaClient } from "@prisma/client";
// import axios from "axios";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import FormData from "form-data";
// import { API_PATHS } from "../../constants/urlConstants.js";
// import { ResponseError } from "../../utils/responseError.js";
// import { extractAadhaarZip } from "../../utils/extractAadhaarZip.js";
// import fs from "fs";

// const prisma = new PrismaClient();

// export const faceMatchHandler = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { files } = req;

//     // Validate selfie image
//     if (!files || !files.selfie_image1) {
//       console.warn("Selfie image is missing");
//       return res.status(400).json({
//         success: false,
//         message: "Selfie image is required",
//       });
//     }

//     // Fetch user and lead details
//     const [user, lead] = await Promise.all([
//       prisma.customer.findUnique({ where: { id: userId } }),
//       prisma.lead.findFirst({
//         where: { customer_id: userId },
//         orderBy: { created_at: "desc" },
//       }),
//     ]);

//     if (!user?.pan) {
//       console.warn(`PAN not found for user ID ${userId}`);
//       return res.status(400).json({
//         success: false,
//         message: "PAN not found for the requested user",
//       });
//     }

//     if (!lead) throw new ResponseError(404, "Lead not found for the user");
//     if (lead.is_rejected) throw new ResponseError(400, "Your lead is rejected");
//     if (!lead.is_loan_requested)
//       throw new ResponseError(400, "Please request your loan first");

//     // Aadhaar document fetch
//     const documentRecord = await prisma.Api_Logs.findFirst({
//       where: { pan: user.pan, api_type: "AADHAAR_KYC" },
//     });
//     // console.log("documentRecord", documentRecord?.api_response);
//     const { zip_data, share_code } = documentRecord?.api_response?.data;

//     const adhar_card = await extractAadhaarZip(zip_data, share_code, user.pan);
//     console.log("adhar_card", adhar_card);

//     const pdfBuffer = fs.readFileSync(adhar_card);
//     // const pdfBuffer = fs.createReadStream(adhar_card)
//     const selfieFile = files.selfie_image1;
//     // console.log("_______pdfBuffer_____",  selfieFile.data,    fs.createReadStream(adhar_card));
//     const formData = new FormData();

//     formData.append("selfie", selfieFile.data, {
//       filename: selfieFile.name || "selfie.jpg",
//       contentType: selfieFile.mimetype || "image/jpeg",
//     });

//     // Attach PDF to form data
//     formData.append("id_card", pdfBuffer, {
//       filename: "aadhaar.jpg",
//       contentType: "image/jpeg",
//     });

//     console.log("Sending face match request to Surepass...");

//     const { data: apiResponse } = await axios.post(
//       API_PATHS.FACEMATCH_URL,
//       formData,
//       {
//         maxBodyLength: Infinity,
//         headers: {
//           Authorization: `Bearer ${process.env.FACE_API_TOKEN}`,
//           ...formData.getHeaders(),
//         },
//       }
//     );

//     console.log("Surepass API response:", apiResponse);

//     // Save to DB
//     // const savedRecord = await prisma.lead.update({
//     //   data: {
//     //     client_id: apiResponse?.data?.client_id || null,
//     //     confidence: apiResponse?.data?.confidence || null,
//     //     match_status: apiResponse?.data?.match_status ? "true" : "false",
//     //     s3_key: s3Key,
//     //   },
//     // });

//     // console.log("Face match result saved to DB:", savedRecord);

//     return res.status(200).json({
//       success: true,
//       message: "Face match processed successfully",
//       // data: savedRecord,
//     });

//     // fs.readFile(adhar_card, 'utf8', (err, data) => {
//     //   if (err) {
//     //     console.error('❌ Error reading file:', err);
//     //     return;
//     //   }
//     //   console.log('📄 File contents:', data);

//     // });

//     // Prepare FormData for API request
//     // const selfieFile = files.selfie_image1;
//     // const formData = new FormData();
//     // formData.append("selfie", selfieFile.data, {
//     //   filename: selfieFile.name || "selfie.jpg",
//     //   contentType: selfieFile.mimetype || "image/jpeg",
//     // });

//     // formData.append("id_card", aadhaarBuffer, {
//     //   filename: "aadhaar.jpg", // Name as needed
//     //   contentType: "image/jpeg", // Assuming Aadhaar image is JPEG
//     // });

//     // console.log("Sending face match request to Surepass...");

//     // // Call Surepass API
//     // const { data: apiResponse } = await axios.post(
//     //   API_PATHS.FACEMATCH_URL,
//     //   formData,
//     //   {
//     //     maxBodyLength: Infinity,
//     //     headers: {
//     //       Authorization: `Bearer ${process.env.FACE_API_TOKEN}`,
//     //       ...formData.getHeaders(),
//     //     },
//     //   }
//     // );

//     // console.log("Surepass API response:", apiResponse);

//     // // Save response to S3
//     // const s3Key = `face-match/${uuidv4()}.json`;
//     // await s3.send(
//     //   new PutObjectCommand({
//     //     Bucket: process.env.AWS_S3_BUCKET,
//     //     Key: s3Key,
//     //     Body: JSON.stringify(apiResponse),
//     //     ContentType: "application/json",
//     //   })
//     // );
//     // console.log("Face match result uploaded to S3:", s3Key);

//     // // Save to DB
//     // const savedRecord = await prisma.faceMatch.create({
//     //   data: {
//     //     client_id: apiResponse?.data?.client_id || null,
//     //     confidence: apiResponse?.data?.confidence || null,
//     //     match_status: apiResponse?.data?.match_status ? "true" : "false",
//     //     s3_key: s3Key,
//     //   },
//     // });

//     // console.log("Face match result saved to DB:", savedRecord);

//     // return res.status(200).json({
//     //   success: true,
//     //   message: "Face match processed successfully",
//     //   data: savedRecord,
//     // });
//   } catch (error) {
//     console.error("Face match handler error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };
