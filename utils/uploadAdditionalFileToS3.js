import AWS from 'aws-sdk';

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
export const uploadAdditionalFileToS3 = async (file, bucketName, pan, file_type) => {
    try {
        if (!file) {
            throw new Error('Invalid file data provided');
        }

        if (!bucketName || !pan || !file_type) {
            throw new Error('Missing required parameters: bucketName, pan, or file_type');
        }


        // Get file extension from original file name or use provided fileType
        const newFileName = `${file_type}_${Date.now().toString()}.${file.mimetype.split('/')[1]}`;

        // Create folder path using PAN number
        const folderPath = `${pan}/additional_document/`;

        const params = {
            Bucket: bucketName,
            Key: folderPath + newFileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        };


        const uploadResponse = await s3.upload(params).promise();
        return uploadResponse.Location;


    } catch (error) {
        console.error('UploadAdditionalFileToS3 Error:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
        });
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};