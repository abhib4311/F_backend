import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const exec = promisify(execCb);

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

// Main function
const sendEncryptedRequest = async () => {
  const timestamp = getCurrentTimestamp();

  const requestParams = {
    localTxnDtTime: timestamp,
    beneAccNo: "9547383416",
    beneIFSC: "KKBK0005310",
    amount: "1",
    tranRefNo: timestamp,
    tranRefNo: "IMPSTesting01",
    paymentRef: "IMPSTransferP2A",
    senderName: "Girdhar Mishra",
    mobile: "8423197351",
    retailerCode: "rcode",
    passCode: "447c4524c9074b8c97e3a3c40ca7458d",
    bcID: "IBCKer00055",
  };

  console.log(
    "<<========Request Params=========>>",
    JSON.stringify(requestParams)
  );

  // AES session key and IV
  const sessionKey = "1234567890123456";
  const iv = "1234567890123456";

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
    console.log("--->" , url)
    const headers = {
      "cache-control": "no-cache",
      accept: "application/json",
      "content-type": "application/json",
      apikey: process.env.ICICI_API_KEY || "",
      "x-priority": "0100",
    };

    const response = await axios.post(url, requestBody, { headers });
    console.log("<<========Encrypted Response=========>>", response.data);

    // Decrypt response
    const encryptedKeyBuffer = Buffer.from(
      response.data.encryptedKey,
      "base64"
    );
    const tempEncryptedKeyPath = path.join(process.cwd(), "encrypted_key.bin");
    fs.writeFileSync(tempEncryptedKeyPath, encryptedKeyBuffer);

    const privateKeyPath = path.join(process.cwd(), "certs", "private.key");
    const opensslCommand = `openssl rsautl -decrypt -inkey "${privateKeyPath}" -in "${tempEncryptedKeyPath}"`;
    const { stdout: decryptedKey } = await exec(opensslCommand);
    const decryptedSessionKey = decryptedKey.trim();

    const encryptedResponseData = Buffer.from(
      response.data.encryptedData,
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
    return decryptedData
  } catch (error) {
    if (error.response) {
      console.log(
        "Third Party API Error :",
        error.response || "Third Party API Error"
      );
    } else {
      console.log(
        "<<========Error during API Call=========>>",
        error
      );
    }
    return error
  }
};

// Run it
// console.log(sendEncryptedRequest());
export {sendEncryptedRequest};
