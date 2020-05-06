const config = require('../config/config')
const uuid = require('uuid')

const AWS = require('aws-sdk')
AWS.config.update({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})
var s3 = new AWS.S3();


exports.uploadBase64Image = async (base64) => {
  const base64Data = new Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
  const fileType = base64.split(';')[0].split('/')[1];
  let fileName = uuid();
  var fileParam = {
    Bucket: config.AWS.AWS_S3_BUCKET_NAME,
    Key: `${fileName}.${fileType}`, 
    Body: base64Data,
    ContentEncoding: 'base64',
    ACL: 'public-read',
    ContentType: `image/${fileType}`
  };
  try {
    const { Location, Key } = await s3.upload(fileParam).promise();
    return Location;
  } catch (error) {
    throw(error)
  }
}

exports.removeFile = async (originalFile) => {
  try {
    const removeParam = {
      Bucket: config.AWS.AWS_S3_BUCKET_NAME,
      Key: originalFile
    }
    await s3.deleteObject(removeParam).promise();
  } catch (error) {
    throw error
  }
}