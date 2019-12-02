const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuidv1 = require('uuid/v1');
const extractFrames = require('ffmpeg-extract-frames')
const { createCanvas, loadImage } = require('canvas')
const pngFileStream = require('png-file-stream');
const fs = require('fs');
const GIFEncoder = require('gifencoder');

const config = require('../config/config')
const Video = require('../models/video');
const { DB_PORT } = require('../config/database')
const { TEMP_PATH, GIF_PATH } = require('../config/path')

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const migrate = async() => {
  const videos = await Video.find({del: false}).catch(err=>{
    console.log('err', err)
  })
    
  if(videos){
    for(let i=0; i<videos.length; i++){
      const video = videos[i]
      
      if(!video['preview']){
        let url =  video.url
        console.log('url', url.slice(44))
        const params = {
          Bucket: 'teamgrow',
          Key: url.slice(44)
        }
        const file_path = TEMP_PATH + uuidv1()
        let fileStream = fs.createWriteStream(file_path);
        let s3Stream = s3.getObject(params).createReadStream();
        // Listen for errors returned by the service
        
        s3Stream.pipe(fileStream).on('error', function(err) {
          // capture any errors that occur when writing data to the file
          console.error('File Stream:', err);
        }).on('end', async() => {
          await generatePreview(file_path).then((preview)=>{
            video['updated_at'] = new Date()
            video['preview'] = preview
            video.save().then((_video)=>{
              console.info('Successfully converted')
            }).catch(err=>{
              console.log('err', err)
            })
          }).catch(err=>{
            console.log('err', err)
          })
        });
        break;
      }
    }
  }
}

const generatePreview = async(file_path) => {

  return new Promise(async(resolve, reject) => {    
    let offsets = []
    for(let i=0; i<4000; i+=100){
      offsets.push(i);
    }
    
    await extractFrames({
      input: file_path,
      output: GIF_PATH+'screenshot-%i.jpg',
      offsets: offsets
    }).catch(err=>{
      console.log('err', err)
    });  
    
    const play = await loadImage(GIF_PATH+'play-button.png');
    
    const canvas = createCanvas(250, 140)
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(250, 140);
    
    for(let i=1; i<40; i++){
      image = await loadImage(GIF_PATH+`screenshot-${i}.jpg`);
      
      let height = image.height;
      let width = image.width;
      if(height > width) {
        ctx.rect(0, 0, 250, 140);
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = 140*width/height;
        height = 140;
        ctx.drawImage(image, (250-width)/2, 0, width, height);
      } else {
        height = 140;
        width = 250;
        ctx.drawImage(image, 0, 0, width, height);
      }
      ctx.rect(60, 100, 150, 30);
      ctx.globalAlpha  = 0.7;
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.font = '20px Impact'
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Play a video', 70, 120)
      ctx.drawImage(play, 10, 95, 40, 40)
      let buf = canvas.toBuffer();
      fs.writeFileSync(GIF_PATH+`frame-${i}.png`, buf)
    }
    const file_name = uuidv1()
    const stream = pngFileStream(GIF_PATH+'frame-??.png')
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH+file_name));

      stream.on('finish', () => {
        if (fs.existsSync(GIF_PATH+file_name)) {
          fs.readFile(GIF_PATH+file_name, (err, data) => {
            if (err) throw err;
            console.log('File read was successful', data)
            const today = new Date()
            const year = today.getYear()
            const month = today.getMonth()
            const params = {
                Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                Key: 'gif' +  year + '/' + month + '/' + file_name, 
                Body: data,
                ACL: 'public-read'
            };
            s3.upload(params, async (s3Err, upload)=>{
              if (s3Err) throw s3Err
              console.log(`File uploaded successfully at ${upload.Location}`)
              
              fs.unlinkSync(GIF_PATH+file_name)
              resolve(upload.Location)
            })
         });}   
      });
      stream.on('error', err=>{
        console.log('err', err)
        reject(err)
      });
    });
}

migrate()