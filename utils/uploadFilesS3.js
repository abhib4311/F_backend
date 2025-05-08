import AWS from 'aws-sdk';

export const uploadFileToS3 = async (file, bucketName, pan) => {
    try {
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });

        const newFileName = `bs_${Date.now().toString()}.pdf`;
        const folderPath = `bank_statement/${pan}/`;
        const params = {
            Bucket: bucketName,
            Key: `${folderPath}${newFileName}`, // Include folder structure in the Key
            Body: file.data
        };

        return new Promise((resolve, reject) => {
            s3.upload(params, {}, (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    console.log(data);
                    resolve(data);
                }
            });
        });

    } catch (e) {
        console.error(e);
        throw e;
    }
};