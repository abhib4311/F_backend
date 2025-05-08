import AWS from 'aws-sdk';

const uploadFileToS3 = async (file, bucketName) => {
    try {
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });

        const newFileName = `bs_${Date.now().toString()}.${file.mimetype.split('/')[1]}`;

        const params = {
            Bucket: bucketName,
            Key: newFileName,
            Body: file.data
        };

        return new Promise((resolve, reject) => {
            s3.upload(params, (err, data) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                }
                console.log(data);
                resolve(data);
            });
        });

    } catch (e) {
        console.error(e);
        throw e;
    }
};

export { uploadFileToS3 };
