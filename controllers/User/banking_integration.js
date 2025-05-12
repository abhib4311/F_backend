import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import path from "path";
import dotenv from "dotenv";
import asyncHandler from "../../utils/asyncHandler.js";
import logger from "../../utils/logger.js";

dotenv.config();
const exec = promisify(execCb);

const errorMap = {
  501: "Internal exception. Please do status check after sometime",
  401: "Unauthorized. Check the API Key",
  429: "Too Many Requests. Maintain the TPS defined",
  403: "Forbidden. Check the IP address & API Key",
  997: "Bad request or internal exception. Check request packet and do status check",
  8010: "INTERNAL_SERVICE_FAILURE. Contact ICICI Tech team",
  8011: "Host Not Found. Contact ICICI Tech team",
  8012: "BACKEND_CONNECTION_TIMEOUT. Contact ICICI Tech team",
  8013: "BACKEND_READ_TIMEOUT. Contact ICICI Tech team",
  8014: "Bad URL. Contact ICICI Tech team",
  8015: "Invalid decrypted request. Contact ICICI Tech team",
  8016: "Request Decryption Failure. Check encryption and certificate",
  8017: "Request Schema Validation Failure. Contact ICICI Tech team",
  8018: "Response Schema Validation Failure. Contact ICICI Tech team",
  8019: "Response Encryption Failure. Contact ICICI Tech team",
  8099: "Blank Response from Backend. Do status check",
  8123: "Configured amount limit exceeded",
  8096: "Invalid request. Request failed",
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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return `${timestamp}${randomPart}`.toUpperCase(); // e.g., "20250502143023A9BZLQ"
}

// Main function
export const sendEncryptedRequest = async (
  beneAccNo,
  beneIFSC,
  amount,
  lead
) => {
  try {
    const ref_no = generateTransactionId();
    let data = {
      tranRefNo: ref_no,
    };
    logger.warn(`Initiate Auto Disbursal API LEAD-ID${lead.id}`);
    const timestamp = getCurrentTimestamp();

    const formattedAmount = parseFloat(amount).toFixed(2);
    console.log("Formatted Amount -->" , formattedAmount)
    const requestParams = {
      localTxnDtTime: timestamp,
      beneAccNo: beneAccNo,
      beneIFSC: beneIFSC,
      amount: "10.00",
      tranRefNo: ref_no,
      paymentRef: "IMPSTransferP2A",
      senderName: "UY fincorp",
      mobile: "9896956566",
      retailerCode: "rcode",
      passCode: "0f1f8b6dcebd4e5d89f20a78a06a3c26",
      bcID: "IBCUY01852",
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
    console.log(" ------------- BANK PUBLIC---------->", publicKey);

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

    const url = process.env.ICICI_BANK_COMPOSITE_API;
    console.log("--->", url);
    const headers = {
      "cache-control": "no-cache",
      accept: "application/json",
      "content-type": "application/json",
      apikey: process.env.ICICI_API_KEY,
      "x-priority": "0100",
    };

    const response = await axios.post(url, requestBody, { headers });
    // console.log("<<========Encrypted Response=========>>", response.data);
    logger.warn(
      `Response of Auto Disbursal API LEAD-ID${
        lead?.id
      } , Response : ${JSON.stringify(response?.data)}`
    );

    console.log("Hii----- 22222222");
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

    // dummy response
    /*
     {
      ActCode: '0',
      Response: 'Transaction Successful',
      BankRRN: '512911028888',
      BeneName: 'Prem Kushum',
      success: true,
      TransRefNo: '202505090531104F2TTU'
    }
    */
    const parsedData = JSON.parse(decryptedData);
    data = {
      ...parsedData,
    };

    // 997 and 501 error code for
    // condition for pending payment
    if (!parsedData?.success || parsedData?.ActCode !== "0") {
      const errorCode = parsedData?.ActCode;
      if (errorCode == "997" || errorCode == "501") {
        logger.warn(
          `Auto Disbursal API LEAD-ID${
            lead?.id
          } , Pending Status: ${JSON.stringify(parsedData)}`
        );

        data.status = "PENDING";
        return data;
      } else {
        logger.warn(
          `Auto Disbursal API LEAD-ID${
            lead?.id
          } , Failed Status: ${JSON.stringify(parsedData)}`
        );
        data.status = "FAILED";
        return data;
      }
    }

    // for sucess condition
    if (parsedData?.ActCode == "0") {
      data.status = "SUCCESS";
      return data;
    }

    // fallback condition
    data.status = "FAILED";
    return data;
  } catch (error) {
    // Axios error handling
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorCode = error.response?.data?.errorCode;
      logger.warn(
        `Auto Disbursal API LEAD-ID${lead?.id} , In Catch Block Status Code: ${statusCode} ,Error Code :${errorCode}`
      );

      if (statusCode === 501 || errorCode === "501") {
        return {
          success: false,
          status: "PENDING",
          message: errorMap["501"],
        };
      }

      return {
        success: false,
        status: "FAILED",
        message: errorMap[errorCode],
      };
    }

    // Fallback error handler
    const knownErrorCode = Object.keys(errorMap).find((code) =>
      error.message.includes(code)
    );
    return {
      success: false,
      status: "FAILED",
      errorCode: knownErrorCode || "UNKNOWN_ERROR",
      message: knownErrorCode ? errorMap[knownErrorCode] : error.message,
    };
  }
};
