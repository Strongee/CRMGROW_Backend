const uuid = require('uuid');
const AWS = require('aws-sdk');
const config = require('../config/config');

AWS.config.update({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION,
});
var s3 = new AWS.S3();

exports.uploadBase64Image = async (base64, dest = '') => {
  const base64Data = new Buffer.from(
    base64.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  );
  const fileType = base64.split(';')[0].split('/')[1];
  const fileName = uuid();
  var fileParam = {
    Bucket: config.AWS.AWS_S3_BUCKET_NAME,
    Key: `${dest ? dest + '/' : ''}${fileName}.${fileType}`,
    Body: base64Data,
    ContentEncoding: 'base64',
    ACL: 'public-read',
    ContentType: `image/${fileType}`,
  };
  try {
    const { Location, Key } = await s3.upload(fileParam).promise();
    console.log(Location, Key);
    return Location;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.removeFile = async (originalFile) => {
  try {
    const removeParam = {
      Bucket: config.AWS.AWS_S3_BUCKET_NAME,
      Key: originalFile,
    };
    await s3.deleteObject(removeParam).promise();
  } catch (error) {
    console.log(error);
    throw error;
  }
};
