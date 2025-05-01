import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Utility function to extract MIME type from base64 string
const extractMimeType = (base64String) => {
  const match = base64String.match(/^data:(.*?);base64,/);
  return match ? match[1] : null;
};

// Utility function to get the file extension from MIME type
const getFileExtension = (mimeType) => {
  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpeg";
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    default:
      return "";
  }
};

export const uploadSanctionLetterS3 = async (base64String, pan, fileNameWithoutExt, forcedMimeType = null) => {
  try {
    let mimeType = extractMimeType(base64String);
    let base64Data;

    if (mimeType) {
      // If data URI prefix exists
      base64Data = base64String.replace(/^data:.*;base64,/, "");
    } else {
      // Fallback: assume raw base64 and use forcedMimeType or default
      mimeType = forcedMimeType || "image/jpeg"; // or whatever you expect by default
      base64Data = base64String;
    }

    const buffer = Buffer.from(base64Data, "base64");
    const fileExt = getFileExtension(mimeType);

    if (!fileExt) throw new Error("Unsupported or unknown file type");

    const filePath = `${pan}/${fileNameWithoutExt}${fileExt}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: filePath,
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: mimeType,
    };

    const uploadResponse = await s3.upload(params).promise();
    console.log(`${mimeType} uploaded successfully:`, uploadResponse.Location);
    return uploadResponse.Location;
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw error;
  }
};

