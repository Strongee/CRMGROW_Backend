const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const fs = require('fs')
const { THUMBNAILS_PATH, ENV_PATH } = require('../config/path')
const Video = require('../models/video')
require('dotenv').config({ path: ENV_PATH })
const config = require('../config/config')
const sharp = require('sharp')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})
const { DB_PORT } = require('../config/database')

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))


const thumbnail_job = async() => {
  const videos = await Video.find({del: false, type: {$nin: ['youtube', 'vimeo']}}).catch(err=>{
    console.log('videos err', err.message)
  })
  // for(let i = 0; i <videos.length; i++){
    const video = videos[0]
    if (video['thumbnail'] ) {
      const file_name = video['thumbnail'].slice(28)
      console.log('path', file_name)
      if (fs.existsSync(THUMBNAILS_PATH+file_name)) {  
        fs.readFile(THUMBNAILS_PATH+file_name, (err, data) => {
          if (err) throw err;
          console.log('File read was successful', data)
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
              Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
              Key: 'thumbnail' +  year + '/' + month + '/' + file_name, 
              Body: data,
              ACL: 'public-read'
          };
          s3.upload(params, async (s3Err, upload)=>{
            if (s3Err) throw s3Err
            console.log(`File uploaded successfully at ${upload.Location}`)
            
            video['thumbnail'] = upload.Location
            video.save().catch(err=>{
              console.log('video save error', err.message)
            })
          })
       });
       
       sharp(THUMBNAILS_PATH+file_name)
       .resize(250, 140)
       .toBuffer()
       .then(data => {
           const params = {
             Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
             Key: 'thumbnail' +  year + '/' + month + '/' + file_name + '-resize', 
             Body: data,
             ACL: 'public-read'
           };
           
           s3.upload(params, async (s3Err, upload)=>{
            if (s3Err) throw s3Err
            console.log(`File uploaded successfully at ${upload.Location}`)
          })
       });
      } 
    }
  // }
}

thumbnail_job()

