import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import path from "path";
import dotenv from "dotenv";
import asyncHandler from "../../utils/asyncHandler.js";
import { ResponseError } from "../../utils/responseError.js";


dotenv.config();
const exec = promisify(execCb);


const errorMap = {
  '501': 'Internal exception. Please do status check after sometime',
  '401': 'Unauthorized. Check the API Key',
  '429': 'Too Many Requests. Maintain the TPS defined',
  '403': 'Forbidden. Check the IP address & API Key',
  '997': 'Bad request or internal exception. Check request packet and do status check',
  '8010': 'INTERNAL_SERVICE_FAILURE. Contact ICICI Tech team',
  '8011': 'Host Not Found. Contact ICICI Tech team',
  '8012': 'BACKEND_CONNECTION_TIMEOUT. Contact ICICI Tech team',
  '8013': 'BACKEND_READ_TIMEOUT. Contact ICICI Tech team',
  '8014': 'Bad URL. Contact ICICI Tech team',
  '8015': 'Invalid decrypted request. Contact ICICI Tech team',
  '8016': 'Request Decryption Failure. Check encryption and certificate',
  '8017': 'Request Schema Validation Failure. Contact ICICI Tech team',
  '8018': 'Response Schema Validation Failure. Contact ICICI Tech team',
  '8019': 'Response Encryption Failure. Contact ICICI Tech team',
  '8099': 'Blank Response from Backend. Do status check',
  '8123': 'Configured amount limit exceeded',
  '8096': 'Invalid request. Request failed'
};

// Utility to generate timestamp
export const getCurrentTimestamp = () => {
  const now = new Date();
  const [yyyy, mm, dd, hh, min, ss] = [
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ].map((n) => n.toString().padStart(2, "0"));

  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
};
const generateRandom16Digit = () => {
  return crypto.randomBytes(8).toString("hex").slice(0, 16);
};
function generateTransactionId(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  return `${timestamp}${randomPart}`.toUpperCase(); // e.g., "20250502143023A9BZLQ"
}


// Main function
export const sendEncryptedRequest = asyncHandler(async (req, res) => {
  console.log("----------- HII-1 ------------------------")
  const timestamp = getCurrentTimestamp();

  // ----------- UAT REQUEST ------------ 
  // const requestParams = {
  //   "localTxnDtTime": timestamp,
  //   "beneAccNo": "123456041",
  //   "beneIFSC": "NPCI0000001",
  //   "amount": "1.00",
  //   "tranRefNo": timestamp,
  //   "paymentRef": "IMPSTransferP2A",
  //   "senderName": "Pratik Mundhe",
  //   "mobile": "9999988888",
  //   "retailerCode": "rcode",
  //   "passCode": "447c4524c9074b8c97e3a3c40ca7458d",
  //   "bcID": "IBCKer00055",
  // };

  const requestParams = {
    "localTxnDtTime": timestamp,
    "beneAccNo": "2649697009",
    "beneIFSC": "KKBK0004265",
    "amount": "1.00",
    "tranRefNo": generateTransactionId,
    "paymentRef": "IMPSTransferP2A",
    "senderName": "UY fincorp",
    "mobile": "9896956566",
    "retailerCode": "rcode",
    "passCode": "0f1f8b6dcebd4e5d89f20a78a06a3c26",
    "bcID": "IBCUY01852",
  };


  console.log(
    "<<========Request Params=========>>",
    JSON.stringify(requestParams)
  );

  // AES session key and IV
  const sessionKey = generateRandom16Digit();
  const iv = generateRandom16Digit();

  // Public key encryption
  const publicKeyPath = path.join(process.cwd(), "certs", "public_key.pem");
  const publicKey = fs.readFileSync(publicKeyPath, "utf8");
  console.log("---------->", publicKey);

  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(sessionKey)
  );

  // AES encrypt request data
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(sessionKey, "utf8"),
    Buffer.from(iv, "utf8")
  );
  let encryptedData = cipher.update(
    JSON.stringify(requestParams),
    "utf8",
    "base64"
  );
  encryptedData += cipher.final("base64");

  // Construct request body
  const requestBody = {
    requestId: `req_${Date.now()}`,
    encryptedKey: encryptedKey.toString("base64"),
    iv: Buffer.from(iv, "utf8").toString("base64"),
    encryptedData,
    oaepHashingAlgorithm: "NONE",
    service: "",
    clientInfo: "",
    optionalParam: "",
  };

  console.log("<<========Final Request Body=========>>", requestBody);

  try {
    const url = process.env.ICICI_BANK_COMPOSITE_API;
    console.log("--->", url)
    const headers = {
      "cache-control": "no-cache",
      accept: "application/json",
      "content-type": "application/json",
      apikey: process.env.ICICI_API_KEY || "",
      "x-priority": "0100",
    };

    const response = await axios.post(url, requestBody, { headers });
    // console.log("<<========Encrypted Response=========>>", response.data);

    console.log("Hii----- 22222222")
    // Decrypt response
    const encryptedKeyBuffer = Buffer.from(
      response?.data?.encryptedKey,
      "base64"
    );
    const tempEncryptedKeyPath = path.join(process.cwd(), "encrypted_key.bin");
    fs.writeFileSync(tempEncryptedKeyPath, encryptedKeyBuffer);

    const privateKeyPath = path.join(process.cwd(), "certs", "private.key");
    const opensslCommand = `openssl rsautl -decrypt -inkey "${privateKeyPath}" -in "${tempEncryptedKeyPath}"`;
    const { stdout: decryptedKey } = await exec(opensslCommand);
    const decryptedSessionKey = decryptedKey.trim();

    const encryptedResponseData = Buffer.from(
      response?.data?.encryptedData,
      "base64"
    );
    const responseIv = encryptedResponseData.slice(0, 16);
    const encryptedPayload = encryptedResponseData.slice(16);

    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      Buffer.from(decryptedSessionKey, "utf8"),
      responseIv
    );
    let decryptedData = decipher.update(encryptedPayload, undefined, "utf8");
    decryptedData += decipher.final("utf8");

    console.log(
      "<<========Decrypted Response=========>>",
      JSON.parse(decryptedData)
    );

    if (!decryptedData?.success) {
      const errorCode = decryptedData?.errorCode;
      throw new ResponseError(errorMap[errorCode] || 'Unknown error occurred');
    }

    if (decryptedData?.success) {
      if (decryptedData?.ActCode != "0") {
        throw new ResponseError(decryptedData?.Response || 'Unknown error occurred from BANK API');
      }
    }


    return res.status(200).json({
      success: true,
      data: decryptedData,
      tranRefNo: requestParams?.tranRefNo
    });
  } catch (error) {
    // console.log('Payment Error:-->', error);
    
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorCode = error.response?.data?.errorCode;
      console.log("------------ ERROR ----------" , error?.response?.data)
      return res.status(statusCode).json({
        success: false,
        errorCode,
        message: errorMap[errorCode] || error.message
      });
    }

    console.log('Payment Error:-->', error);
    // Handle known error codes
    const errorCode = Object.keys(errorMap).find(code =>
      error.message.includes(code)
    );

    res.status(500).json({
      success: false,
      errorCode: errorCode || 'UNKNOWN_ERROR',
      message: errorCode ? errorMap[errorCode] : error.message
    });
  }
});



// const status_check = async () => {
//   const timestamp = getCurrentTimestamp();

//   const requestParams = {

//     transRefNo: 20250501191601,
//     date: "2/05/2025",
//     recon360: "N",
//     passCode: "447c4524c9074b8c97e3a3c40ca7458d",
//     bcID: "IBCKer00055",

//   };

//   console.log(
//     "<<========Request Params=========>>",
//     JSON.stringify(requestParams)
//   );

//   // AES session key and IV
//   const sessionKey = generateRandom16Digit();
//   const iv = generateRandom16Digit();

//   // Public key encryption
//   const publicKeyPath = path.join(process.cwd(), "certs", "public_key.pem");
//   const publicKey = fs.readFileSync(publicKeyPath, "utf8");
//   console.log("---------->", publicKey);

//   const encryptedKey = crypto.publicEncrypt(
//     {
//       key: publicKey,
//       padding: crypto.constants.RSA_PKCS1_PADDING,
//     },
//     Buffer.from(sessionKey)
//   );

//   // AES encrypt request data
//   const cipher = crypto.createCipheriv(
//     "aes-128-cbc",
//     Buffer.from(sessionKey, "utf8"),
//     Buffer.from(iv, "utf8")
//   );
//   let encryptedData = cipher.update(
//     JSON.stringify(requestParams),
//     "utf8",
//     "base64"
//   );
//   encryptedData += cipher.final("base64");

//   // Construct request body
//   const requestBody = {
//     requestId: `req_${Date.now()}`,
//     encryptedKey: encryptedKey.toString("base64"),
//     iv: Buffer.from(iv, "utf8").toString("base64"),
//     encryptedData,
//     oaepHashingAlgorithm: "NONE",
//     service: "",
//     clientInfo: "",
//     optionalParam: "",
//   };

//   console.log("<<========Final Request Body=========>>", requestBody);

//   try {
//     const url = process.env.ICICI_BANK_STATUS_CHECK;
//     console.log("--->", url)
//     const headers = {
//       "cache-control": "no-cache",
//       accept: "application/json",
//       "content-type": "application/json",
//       apikey: process.env.ICICI_API_KEY || "",
//       "x-priority": "0100",
//     };

//     const response = await axios.post(url, requestBody, { headers });
//     console.log("<<========Encrypted Response=========>>", response.data);

//     // Decrypt response
//     const encryptedKeyBuffer = Buffer.from(
//       response.data.encryptedKey,
//       "base64"
//     );
//     const tempEncryptedKeyPath = path.join(process.cwd(), "encrypted_key.bin");
//     fs.writeFileSync(tempEncryptedKeyPath, encryptedKeyBuffer);

//     const privateKeyPath = path.join(process.cwd(), "certs", "private.key");
//     const opensslCommand = `openssl rsautl -decrypt -inkey "${privateKeyPath}" -in "${tempEncryptedKeyPath}"`;
//     const { stdout: decryptedKey } = await exec(opensslCommand);
//     const decryptedSessionKey = decryptedKey.trim();

//     const encryptedResponseData = Buffer.from(
//       response.data.encryptedData,
//       "base64"
//     );
//     const responseIv = encryptedResponseData.slice(0, 16);
//     const encryptedPayload = encryptedResponseData.slice(16);

//     const decipher = crypto.createDecipheriv(
//       "aes-128-cbc",
//       Buffer.from(decryptedSessionKey, "utf8"),
//       responseIv
//     );
//     let decryptedData = decipher.update(encryptedPayload, undefined, "utf8");
//     decryptedData += decipher.final("utf8");

//     console.log(
//       "<<========Decrypted Response=========>>",
//       JSON.parse(decryptedData)
//     );
//     return decryptedData
//   } catch (error) {
//     if (error.response) {
//       console.log(
//         "Third Party API Error :",
//         error.response || "Third Party API Error"
//       );
//     } else {
//       console.log(
//         "<<========Error during API Call=========>>",
//         error
//       );
//     }
//     return error
//   }
// };

// Run it

// export { sendEncryptedRequest };
