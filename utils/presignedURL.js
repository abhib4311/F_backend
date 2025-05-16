import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.S3_AWS_REGION,
});

// Split URL into bucket and key
const splitS3Url = (s3Url) => {
    try {
        console.log("sfgdsfsdghkds")
        const url = new URL(s3Url);
        const bucket = url.hostname.split('.')[0];
        const key = decodeURIComponent(url.pathname.slice(1));
        return { bucket, key };
    } catch (err) {
        console.error("Invalid S3 URL:", err.message);
        return null;
    }
};

// Generate pre-signed URL
export const generatePresignedUrl = (s3Url, expiresInSeconds = 900) => {
    console.log("4444444444444444444444444444444444444")
    const { bucket, key } = splitS3Url(s3Url);
    const params = {
        Bucket: bucket,
        Key: key,
        Expires: expiresInSeconds,
    };
    return s3.getSignedUrl('getObject', params);
};

// Usage example
// const fileUrl = "https://testing-blinkr.s3.amazonaws.com/OZBPS5665H/sanction_letter.pdf";
// const presignedUrl = generatePresignedUrl(fileUrl);

// console.log('Presigned URL:', presignedUrl);