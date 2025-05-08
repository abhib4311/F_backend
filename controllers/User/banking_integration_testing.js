// import fs from 'fs';
// import path from 'path';
// import crypto from 'crypto';
// import axios from 'axios';
// import { exec } from 'child_process';
// import util from 'util';
// import dotenv from 'dotenv';
// dotenv.config();
// const execPromise = util.promisify(exec);

// // Error Map
// const errorMap = {
//     '501': 'Internal exception. Please do status check after sometime',
//     '401': 'Unauthorized. Check the API Key',
//     '429': 'Too Many Requests. Maintain the TPS defined',
//     '403': 'Forbidden. Check the IP address & API Key',
//     '997': 'Bad request or internal exception. Check request packet and do status check',
//     '8010': 'INTERNAL_SERVICE_FAILURE. Contact ICICI Tech team',
//     '8011': 'Host Not Found. Contact ICICI Tech team',
//     '8012': 'BACKEND_CONNECTION_TIMEOUT. Contact ICICI Tech team',
//     '8013': 'BACKEND_READ_TIMEOUT. Contact ICICI Tech team',
//     '8014': 'Bad URL. Contact ICICI Tech team',
//     '8015': 'Invalid decrypted request. Contact ICICI Tech team',
//     '8016': 'Request Decryption Failure. Check encryption and certificate',
//     '8017': 'Request Schema Validation Failure. Contact ICICI Tech team',
//     '8018': 'Response Schema Validation Failure. Contact ICICI Tech team',
//     '8019': 'Response Encryption Failure. Contact ICICI Tech team',
//     '8099': 'Blank Response from Backend. Do status check',
//     '8123': 'Configured amount limit exceeded',
//     '8096': 'Invalid request. Request failed'
// };

// // Utility functions
// function generateRandom16Digit() {
//     return crypto.randomBytes(8).toString('hex').slice(0, 16);
// }

// async function decryptResponse(encryptedKey, encryptedData) {
//     try {
//         // Decrypt session key with private key
//         const privateKeyPath = path.join(process.cwd(), 'certs', 'private.key');
//         const opensslCommand = `openssl rsautl -decrypt -inkey "${privateKeyPath}"`;

//         const { stdout: decryptedKey } = await execPromise(
//             opensslCommand,
//             { input: Buffer.from(encryptedKey, 'base64') }
//         );

//         // Decrypt data with AES
//         const decipher = crypto.createDecipheriv(
//             'aes-128-cbc',
//             Buffer.from(decryptedKey.trim(), 'utf8'),
//             Buffer.from(encryptedData.slice(0, 16), 'utf8')
//         );

//         const decrypted = Buffer.concat([
//             decipher.update(encryptedData.slice(16)),
//             decipher.final()
//         ]);

//         return JSON.parse(decrypted.toString());
//     } catch (error) {
//         throw new Error(`Decryption failed: ${error.message}`);
//     }
// }

// // IMPS Payment Initiation
// async function initiatePayment() {

//     try {
//         // Validate request
//         // const requiredFields = [
//         //     'localTxnDtTime', 'beneAccNo', 'benelFSC',
//         //     'amount', 'tranRefNo', 'senderName', 'mobile'
//         // ];
//         // const missingFields = requiredFields.filter(field => !req.body[field]);

//         // if (missingFields.length > 0) {
//         //     return res.status(400).json({
//         //         success: false,
//         //         message: `Missing required fields: ${missingFields.join(', ')}`
//         //     });
//         // }

//         // Construct request payload
//         const requestParams = {
//             ...req.body,
//             retailerCode: 'rcode',
//             passCode: process.env.IMPS_PASSCODE,
//             bcID: process.env.IMPS_BCID
//         };

//         // Generate encryption components
//         const sessionKey = generateRandom16Digit();
//         const iv = generateRandom16Digit();

//         // Encrypt session key with ICICI public key
//         const publicKey = fs.readFileSync(
//             path.join(process.cwd(), 'certs', 'icici_public.pem'),
//             'utf8'
//         );

//         const encryptedKey = crypto.publicEncrypt(
//             { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
//             Buffer.from(sessionKey)
//         );

//         // Encrypt payload with AES
//         const cipher = crypto.createCipheriv('aes-128-cbc', sessionKey, iv);
//         let encryptedData = cipher.update(JSON.stringify(requestParams), 'utf8', 'base64');
//         encryptedData += cipher.final('base64');

//         // Construct final request
//         const requestBody = {
//             requestId: `imps_${Date.now()}`,
//             encryptedKey: encryptedKey.toString('base64'),
//             iv: Buffer.from(iv).toString('base64'),
//             encryptedData,
//             oaepHashingAlgorithm: 'NONE'
//         };

//         // Send request to ICICI
//         const response = await axios.post(
//             process.env.IMPS_PAYMENT_URL,
//             requestBody,
//             {
//                 headers: {
//                     'Content-Type': 'application/json',
//                     apikey: process.env.ICICI_API_KEY,
//                     'x-priority': '0100'
//                 }
//             }
//         );

//         // Handle encrypted response
//         if (!response.data.encryptedKey || !response.data.encryptedData) {
//             throw new Error('Invalid response structure from bank');
//         }

//         const decryptedResponse = await decryptResponse(
//             response.data.encryptedKey,
//             response.data.encryptedData
//         );

//         // Handle bank response
//         if (!decryptedResponse.success) {
//             const errorCode = decryptedResponse.errorCode || decryptedResponse.responseCode;
//             throw new Error(errorMap[errorCode] || 'Unknown error occurred');
//         }

//         res.json({
//             success: true,
//             data: decryptedResponse,
//             tranRefNo: requestParams.tranRefNo
//         });

//     } catch (error) {
//         console.error('Payment Error:', error);

//         // Handle Axios errors
//         if (axios.isAxiosError(error)) {
//             const statusCode = error.response?.status || 500;
//             const errorCode = error.response?.data?.errorCode;

//             return res.status(statusCode).json({
//                 success: false,
//                 errorCode,
//                 message: errorMap[errorCode] || error.message
//             });
//         }

//         // Handle known error codes
//         const errorCode = Object.keys(errorMap).find(code =>
//             error.message.includes(code)
//         );

//         res.status(500).json({
//             success: false,
//             errorCode: errorCode || 'UNKNOWN_ERROR',
//             message: errorCode ? errorMap[errorCode] : error.message
//         });
//     }
// };
