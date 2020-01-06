const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const Video = require('../../models/video')
const VideoTracker = require('../../models/video_tracker')
const { GIF_PATH, THUMBNAILS_PATH } = require('../../config/path')
const config = require('../../config/config')
const urls = require('../../constants/urls')
const uuidv1 = require('uuid/v1')
const AWS = require('aws-sdk')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames')
const { createCanvas, loadImage } = require('canvas')
const pngFileStream = require('png-file-stream');
const sharp = require('sharp');

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename
    const video = new Video({
      role: 'admin',
      url: urls.VIDEO_URL+file_name,
      type: req.file.mimetype,
      path: req.file.path,
      created_at: new Date()
    })

    video.save().then((_video)=>{
      res.send({
            status: true,
            data: _video
          })
      })
    
  }
}

const updateDetail = async (req, res) => {
  const editData = req.body
  let thumbnail;
  if (req.body.thumbnail) { // base 64 image    
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    thumbnail = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)
  }
  
  const video = await Video.findOne({_id: req.params.id}).catch(err=>{
    console.log('err', err)
  })

  for (let key in editData) {
    video[key] = editData[key]
  }
  if( thumbnail ){
    video['thumbnail'] = thumbnail
  }
  
  if(!video['preview']){
    const file_path = video['path']
    video['preview'] = await generatePreview(file_path).catch(err=>{
      console.log('err', err)
    })
  }
  
  video['updated_at'] = new Date()
  video.save().then((_video)=>{
    res.send({
      status: true,
      data: _video
    })
  }).catch(err=>{
    console.log('err', err)
  })
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

const get = async (req, res) => {
  const video = await Video.findOne({_id: req.params.id})
    if (!video) {
      return res.status(400).json({
        status: false,
        error: 'Video doesn`t exist'
      })
    }
    myJSON = JSON.stringify(video)
    const data = JSON.parse(myJSON);
    Object.assign(data, {"user": user})

  res.send({
    status: true,
    data
  })

}

const getThumbnail = (req, res) => {
  const filePath = THUMBNAILS_PATH + req.params.name
  
  console.info('File Path:', filePath)
  if (fs.existsSync(filePath)) {
    if(req.query.resize){
      const readStream = fs.createReadStream(filePath)
      let transform = sharp()
      transform = transform.resize(250, 140)
      return readStream.pipe(transform).pipe(res)
    }else{
      const contentType = mime.contentType(path.extname(req.params.name))
      res.set('Content-Type', contentType)
      return res.sendFile(filePath)
    }
  } else {
    return res.status(404).send({
      status: false,
      error: 'Thumbnail does not exist'
    })
  }
}

const getAll = async (req, res) => {
  const {currentUser} = req
  const _video = VideoTracker.find({ user: currentUser.id})

  if (!_video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist'
    })
  }

  const _video_list = await Video.find({user: currentUser.id})

  let _video_detail_list = [];

  for(let i = 0; i < _video_list.length; i ++){
    const _video_detail = await VideoTracker.aggregate([
        {
          $lookup:
            {
            from:  'videos',
            localField: 'video',
            foreignField: '_id',
            as: "video_detail"
            }
        },
        {
          $match: { "video": _video_list[i].id }
        }
    ])

    myJSON = JSON.stringify(_video_list[i])
    const _video = JSON.parse(myJSON);
    const video_detail = await Object.assign(_video, {"views": _video_detail.length})
    _video_detail_list.push(video_detail)
  }

  res.send({
    status: true,
    data: _video_detail_list
  })
}

const getVideos = async (req, res) => {
  const page = req.params.page;
  const skip = (page - 1) * 12;

  const videos = await Video.aggregate([
    {$match: { "del": false }},
    {$skip: skip},
    {$limit: 12}
  ]).catch(err => {
    res.status(500).send({
      status: false,
      error: err
    })
  });
  await Video.populate(videos, {path: 'user', select: 'user_name picture_profile'});

  const videoCounts = await Video.countDocuments({"del": false});

  return res.send({
    status: true,
    data: videos,
    total: videoCounts
  })
}

const sendVideo = async (req, res) => {
  const { currentUser } = req
  const {email, content, video, contact} = req.body
  sgMail.setApiKey(process.env.SENDGRID_KEY);

  const text = content + '\n' + process.env.TEAMGROW_DOMAIN +'/material/view/video/?video=' + video + '&contact=' + contact + '&user=' + currentUser.id
  const msg = {
    to: email,
    from: currentUser.email,
    subject: process.env.WELCOME_SEND_VIDEO_MESSAGE,
    text: text,
    html: text
  }

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){        
      console.log('status', _res[0].statusCode)
    }else {
      res.status(404).send({
        status: false,
        error: _res[0].statusCode
      })
    }
  }).catch ((e) => {
    console.error(e)
    res.status(500).send({
      status: false,
      error: 'internal_server_error'
    })
  })
  res.send({
    status: true,
  })
}

const remove = async (req, res) => {
    try {
      const video = await Video.findOne({ _id: req.params.id}).catch(err=>{
        console.log('err', err)
      })
      let url =  video.url
      
      s3.deleteObject({
        Bucket: config.AWS.AWS_S3_BUCKET_NAME,
        Key: url.slice(44)
      }, function (err,data){
        console.log('err', err)
      })

      video['del'] = true
      video.save()

      return res.send({
        status: true,
      })
    } catch (e) {
      console.error(e)
      res.status(500).send({
        status: false,
        error: 'internal_server_error'
      })
    }
}

module.exports = {
    create,
    updateDetail,
    get,
    getThumbnail,
    getAll,
    sendVideo,
    remove,
    getVideos
}