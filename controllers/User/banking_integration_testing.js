const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require('child_process');

// function getCurrentTimestamp() {
//     const now = new Date();
//     const year = now.getFullYear().toString();
//     const month = (now.getMonth() + 1).toString().padStart(2, '0');
//     const day = now.getDate().toString().padStart(2, '0');
//     const hours = now.getHours().toString().padStart(2, '0');
//     const minutes = now.getMinutes().toString().padStart(2, '0');
//     const seconds = now.getSeconds().toString().padStart(2, '0');
//     return ${year}${month}${day}${hours}${minutes}${seconds};
// }

//imps
const requestParams = {
    "localTxnDtTime": getCurrentTimestamp(),
    "beneAccNo": "",
    "beneIFSC": "",
    "amount": "1",
    "tranRefNo": getCurrentTimestamp(),
    "paymentRef": "",
    "senderName": "",
    "mobile": "",
    "retailerCode": "rcode",
    "passCode": "",
    "bcID": ""
};

console.log("<<========Request Params=========>>", JSON.stringify(requestParams));

const sessionKey = "1234567890123456"; // 16-byte session key
const iv = "1234567890123456"; // 16-byte IV

//ICICI Public Key
const publicKeyPath = "C:/Users/HP/Desktop/New folder (2)/iciciCompositePublicKey.txt";//icici public certificate 
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
const encryptedKey = crypto.publicEncrypt(
    {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(sessionKey)
);
const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(sessionKey, 'utf8'), Buffer.from(iv, 'utf8'));
let encryptedData = cipher.update(JSON.stringify(requestParams), 'utf8', 'base64');
encryptedData += cipher.final('base64');

const requestBody = {
    requestId: req_${Date.now()},
    encryptedKey: encryptedKey.toString('base64'),
    iv: Buffer.from(iv, 'utf8').toString('base64'),
    encryptedData: encryptedData,
    oaepHashingAlgorithm: "NONE",
    service: "",
    clientInfo: "",
    optionalParam: ""
};
console.log("Request: ",(requestBody));
const url = "https://apibankingonesandbox.icicibank.com/api/v1/composite-payment";
const headers = {
    "cache-control": "no-cache",
    "accept": "application/json",
    "content-type": "application/json",
    "apikey": "",
    "x-priority": ""// mode of transction 
};
axios.post(url, requestBody, { headers })
    .then(response => {
        console.log("<<========Response=========>>", response.data);
        const privateKeyPath = "C:/Users/HP/Desktop/New folder (2)/domainCompositePrivateKey.txt";// your private key
        const encryptedKeyBuffer = Buffer.from(response.data.encryptedKey, 'base64');
        const tempEncryptedKeyPath = "encrypted_key.bin";
        fs.writeFileSync(tempEncryptedKeyPath, encryptedKeyBuffer);
        const opensslCommand = openssl rsautl -decrypt -inkey "${privateKeyPath}" -in "${tempEncryptedKeyPath}";
        exec(opensslCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(Error executing OpenSSL: ${stderr});
                return;
            }
            const decryptedSessionKey = stdout.trim();
            const encryptedResponseData = Buffer.from(response.data.encryptedData, 'base64');
            const responseIv = encryptedResponseData.slice(0, 16);
            const encryptedPayload = encryptedResponseData.slice(16);
            const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(decryptedSessionKey, 'utf8'), responseIv);
            let decryptedData = decipher.update(encryptedPayload, 'base64', 'utf8');
            decryptedData += decipher.final('utf8');
            console.log("<<========Decrypted Response=========>>", JSON.parse(decryptedData));
        });
    })
    .catch(error => {
        console.error("Error:", error.message);
    });