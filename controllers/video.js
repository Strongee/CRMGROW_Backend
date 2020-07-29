const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const uuidv1 = require('uuid/v1');
const phone = require('phone');
const AWS = require('aws-sdk');
const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames');
const { createCanvas, loadImage } = require('canvas');
const pngFileStream = require('png-file-stream');
const sharp = require('sharp');
const graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const Activity = require('../models/activity');
const Video = require('../models/video');
const VideoTracker = require('../models/video_tracker');
const Garbage = require('../models/garbage');
const Contact = require('../models/contact');
const Team = require('../models/team');
const {
  THUMBNAILS_PATH,
  TEMP_PATH,
  GIF_PATH,
  VIDEO_PATH,
  PLAY_BUTTON_PATH,
} = require('../config/path');
const urls = require('../constants/urls');
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const mail_contents = require('../constants/mail_contents');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const User = require('../models/user');
const emailHelper = require('../helpers/email.js');
const garbageHelper = require('../helpers/garbage.js');
const textHelper = require('../helpers/text.js');
const videoHelper = require('../helpers/video');
const ActivityHelper = require('../helpers/activity');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);

const play = async (req, res) => {
  const video_id = req.query.video;
  const sender_id = req.query.user;
  const video = await Video.findOne({ _id: video_id }).catch((err) => {
    console.log('err', err.message);
  });
  const user = await User.findOne({ _id: sender_id, del: false }).catch(
    (err) => {
      console.log('err', err.message);
    }
  );

  let capture_dialog = true;
  let capture_delay = 0;
  let capture_field = {};

  if (user) {
    const garbage = await Garbage.findOne({ user: user._id }).catch((err) => {
      console.log('err', err);
    });

    let theme = 'theme2';
    let logo;
    let highlights = [];
    let brands = [];
    let intro_video = '';
    if (garbage) {
      capture_delay = garbage['capture_delay'];
      capture_field = garbage['capture_field'];
      const capture_videos = garbage['capture_videos'];
      if (capture_videos.indexOf(video_id) === -1) {
        capture_dialog = false;
      }
      theme = garbage['material_theme'] || theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];
      intro_video = garbage['intro_video'];
    } else {
      capture_dialog = false;
    }

    const pattern = /^((http|https|ftp):\/\/)/;
    let social_link = {};

    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }

    if (user.social_link) {
      social_link = user.social_link || {};
      if (social_link.facebook && !pattern.test(social_link.facebook)) {
        social_link.facebook = 'http://' + social_link.facebook;
      }
      if (social_link.twitter && !pattern.test(social_link.twitter)) {
        social_link.twitter = 'http://' + social_link.twitter;
      }
      if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
        social_link.linkedin = 'http://' + social_link.linkedin;
      }
    }
    return res.render('lead_material_' + theme, {
      material: video,
      material_type: 'video',
      user,
      capture_dialog,
      capture_delay,
      capture_field: capture_field || {},
      social_link,
      setting: {
        logo,
        highlights,
        brands,
        intro_video,
      },
    });
  } else {
    res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};

const play1 = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id })
    .populate([{ path: 'user' }, { path: 'videos' }])
    .catch((err) => {
      console.log('err', err);
    });

  if (activity) {
    const data = activity['user'];
    const myJSON = JSON.stringify(data);
    const user = JSON.parse(myJSON);
    delete user.hash;
    delete user.salt;
    delete user.payment;

    const video = activity['videos'];

    const pattern = /^((http|https|ftp):\/\/)/;
    let social_link = {};
    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }
    if (user.social_link) {
      social_link = user.social_link || {};
      if (social_link.facebook && !pattern.test(social_link.facebook)) {
        social_link.facebook = 'http://' + social_link.facebook;
      }
      if (social_link.twitter && !pattern.test(social_link.twitter)) {
        social_link.twitter = 'http://' + social_link.twitter;
      }
      if (social_link.linkedin && !pattern.test(social_link.linkedin)) {
        social_link.linkedin = 'http://' + social_link.linkedin;
      }
    }

    let material_start = 0;

    if (activity.material_last) {
      material_start = activity.material_last;
    }
    const garbage = await Garbage.findOne({ user: data._id }).catch((err) => {
      console.log('err', err);
    });

    let theme = 'theme2';
    let logo;
    let highlights = [];
    let brands = [];
    if (garbage) {
      theme = garbage['material_theme'] || theme;
      logo = garbage['logo'] || urls.DEFAULT_TEMPLATE_PAGE_LOGO;
      highlights = garbage['highlights'] || [];
      brands = garbage['brands'] || [];
    }

    return res.render('material_' + theme, {
      material: video,
      material_type: 'video',
      user,
      contact: activity['contacts'],
      activity: activity.id,
      social_link,
      material_start,
      setting: {
        logo,
        highlights,
        brands,
      },
    });
  } else {
    return res.send(
      'Sorry! This video link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};

const embedPlay = async (req, res) => {
  const video = await Video.findOne({ _id: req.params.video });
  res.render('embedVideo', {
    video,
  });
};

const pipe = async (req, res) => {
  const filePath = TEMP_PATH + req.params.name;

  if (fs.existsSync(filePath)) {
    const contentType = mime.contentType(path.extname(req.params.name));
    res.set('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send({
      status: false,
      error: 'File does not exist',
    });
  }
};

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename;

    const video = new Video({
      user: req.currentUser.id,
      url: urls.VIDEO_URL + file_name,
      type: req.file.mimetype,
      path: req.file.path,
      created_at: new Date(),
    });

    const _video = await video
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    res.send({
      status: true,
      data: _video,
    });
  }
};

const createVideo = async (req, res) => {
  const video = new Video({
    ...req.body,
    user: req.currentUser.id,
    created_at: new Date(),
  });

  const _video = await video
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });

  res.send({
    status: true,
    data: _video,
  });
};

const update = async (req, res) => {
  const editData = { ...req.body };
  delete editData.site_image;
  delete editData.thumbnail;
  const { currentUser } = req;
  let thumbnail_path = '';
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('err', err.message);
  });

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.site_image) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const siteImage = await uploadBase64Image(
        req.body.site_image,
        'site_image' + year + '/' + month
      );
      video['site_image'] = siteImage;
    } catch (error) {
      console.error('Upload Site Image', error);
    }
  }
  if (req.body.thumbnail) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const thumbnail_image = await uploadBase64Image(
        req.body.thumbnail,
        'thumbnail' + year + '/' + month
      );
      video['thumbnail'] = thumbnail_image;
    } catch (error) {
      console.error('Upload Video Thumbnail Image', error);
    }
  }

  const file_name = req.params.id;
  if (req.body.thumbnail) {
    // base 64 image

    if (!fs.existsSync(THUMBNAILS_PATH)) {
      fs.mkdirSync(THUMBNAILS_PATH);
    }

    thumbnail_path = base64Img.imgSync(
      req.body.thumbnail,
      THUMBNAILS_PATH,
      file_name
    );
    if (fs.existsSync(thumbnail_path)) {
      // Thumbnail
      if (req.body.thumbnail) {
        const play = await loadImage(PLAY_BUTTON_PATH);

        const canvas = createCanvas(
          system_settings.THUMBNAIL.WIDTH,
          system_settings.THUMBNAIL.HEIGHT
        );
        const ctx = canvas.getContext('2d');
        const image = await loadImage(thumbnail_path);

        let height = image.height;
        let width = image.width;
        if (height > width) {
          ctx.rect(
            0,
            0,
            system_settings.THUMBNAIL.WIDTH,
            system_settings.THUMBNAIL.HEIGHT
          );
          ctx.fillStyle = '#000000';
          ctx.fill();
          width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
          height = system_settings.THUMBNAIL.HEIGHT;
          ctx.drawImage(image, (250 - width) / 2, 0, width, height);
        } else {
          height = system_settings.THUMBNAIL.HEIGHT;
          width = system_settings.THUMBNAIL.WIDTH;
          ctx.drawImage(image, 0, 0, width, height);
        }

        // ctx.rect(70, 170, 200, 40);
        // ctx.globalAlpha = 0.7;
        // ctx.fillStyle = '#333';
        // ctx.fill();
        // ctx.globalAlpha = 1.0;
        // ctx.font = '24px Arial';
        // ctx.fillStyle = '#ffffff';
        // ctx.fillText('Play video', 80, 200);
        ctx.drawImage(play, 10, 150);

        const buf = canvas.toBuffer();

        if (!fs.existsSync(GIF_PATH)) {
          fs.mkdirSync(GIF_PATH);
        }
        for (let i = 0; i < 20; i++) {
          if (i < 10) {
            fs.writeFileSync(GIF_PATH + file_name + `-0${i}.png`, buf);
          } else {
            fs.writeFileSync(GIF_PATH + file_name + `-${i}.png`, buf);
          }
        }
      }

      /**
      sharp(thumbnail_path)
      .resize(250, 140)
      .toBuffer()
      .then(data => {
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'thumbnail' +  year + '/' + month + '/' + file_name, 
            Body: data,
            ACL: 'public-read'
          };
          
          s3.upload(params, async (s3Err, upload)=>{
            if (s3Err){
              console.log('upload s3 error', s3Err)
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`)
            }
          })
      });
      */
    }
  }

  for (const key in editData) {
    video[key] = editData[key];
  }

  if (video['path'] && req.body.thumbnail) {
    const data = {
      file_name,
    };

    regeneratePreview(data)
      .then((res) => {
        Video.updateOne(
          { _id: req.params.id },
          { $set: { preview: res } }
        ).catch((err) => {
          console.log('update preview err', err.message);
        });
      })
      .catch((err) => {
        console.log('err', err.message);
      });
  }

  video['updated_at'] = new Date();
  video
    .save()
    .then((_video) => {
      res.send({
        status: true,
        data: _video,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
    });
};

const updateDetail = async (req, res) => {
  const editData = { ...req.body };
  delete editData.site_image;
  delete editData.thumbnail;
  const { currentUser } = req;
  let thumbnail_path = '';
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('video found err', err.message);
  });

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.site_image) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const siteImage = await uploadBase64Image(
        req.body.site_image,
        'site_image' + year + '/' + month
      );
      video['site_image'] = siteImage;
    } catch (error) {
      console.error('Upload Site Image', error);
    }
  }
  if (req.body.thumbnail) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const thumbnail_image = await uploadBase64Image(
        req.body.thumbnail,
        'thumbnail' + year + '/' + month
      );
      video['thumbnail'] = thumbnail_image;
    } catch (error) {
      console.error('Upload Video Thumbnail Image', error);
    }
  }
  const file_name = req.params.id;
  let custom_thumbnail = false;
  if (req.body.thumbnail) {
    // base 64 image

    if (!fs.existsSync(THUMBNAILS_PATH)) {
      fs.mkdirSync(THUMBNAILS_PATH);
    }

    thumbnail_path = base64Img.imgSync(
      req.body.thumbnail,
      THUMBNAILS_PATH,
      file_name
    );
    if (fs.existsSync(thumbnail_path) && req.body.custom_thumbnail) {
      // Thumbnail
      custom_thumbnail = true;
      const play = await loadImage(PLAY_BUTTON_PATH);

      const canvas = createCanvas(
        system_settings.THUMBNAIL.WIDTH,
        system_settings.THUMBNAIL.HEIGHT
      );
      const ctx = canvas.getContext('2d');
      const image = await loadImage(thumbnail_path);

      let height = image.height;
      let width = image.width;
      if (height > width) {
        ctx.rect(
          0,
          0,
          system_settings.THUMBNAIL.WIDTH,
          system_settings.THUMBNAIL.HEIGHT
        );
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
        height = system_settings.THUMBNAIL.HEIGHT;
        ctx.drawImage(
          image,
          (system_settings.THUMBNAIL.WIDTH - width) / 2,
          0,
          width,
          height
        );
      } else {
        height = system_settings.THUMBNAIL.HEIGHT;
        width = system_settings.THUMBNAIL.WIDTH;
        ctx.drawImage(image, 0, 0, width, height);
      }

      // ctx.rect(70, 170, 200, 40);
      // ctx.globalAlpha = 0.7;
      // ctx.fillStyle = '#333';
      // ctx.fill();
      // ctx.globalAlpha = 1.0;
      // ctx.font = '24px Arial';
      // ctx.fillStyle = '#ffffff';
      // ctx.fillText('Play video', 80, 200);
      ctx.drawImage(play, 10, 150);
      const buf = canvas.toBuffer();

      for (let i = 0; i < 20; i++) {
        if (i < 10) {
          fs.writeFileSync(GIF_PATH + file_name + `-0${i}.png`, buf);
        } else {
          fs.writeFileSync(GIF_PATH + file_name + `-${i}.png`, buf);
        }
      }

      /**
      sharp(thumbnail_path)
      .resize(250, 140)
      .toBuffer()
      .then(data => {
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'thumbnail' +  year + '/' + month + '/' + file_name, 
            Body: data,
            ACL: 'public-read'
          };
          
          s3.upload(params, async (s3Err, upload)=>{
            if (s3Err){
              console.log('upload s3 error', s3Err)
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`)
            }
          })
      });
      */
    }
  }

  for (const key in editData) {
    video[key] = editData[key];
  }

  if (video['path'] && req.body.thumbnail) {
    const data = {
      file_name: req.params.id,
      file_path: video['path'],
      custom_thumbnail,
    };

    generatePreview(data)
      .then((res) => {
        Video.updateOne(
          { _id: req.params.id },
          { $set: { preview: res } }
        ).catch((err) => {
          console.log('update preview err', err.message);
        });
      })
      .catch((err) => {
        console.log('generate preview err', err.message);
      });
  }

  if (video['type'] === 'video/webm') {
    video['converted'] = 'progress';
    videoHelper.convertRecordVideo(video.id);
  } else if (
    video['type'] === 'video/mp4' ||
    video['type'] === 'video/quicktime'
  ) {
    video['converted'] = 'progress';
    videoHelper.convertUploadVideo(video.id);
  }

  video['updated_at'] = new Date();
  video
    .save()
    .then((_video) => {
      console.log('_video', _video);
      return res.send({
        status: true,
        data: _video,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

const updateDefault = async (req, res) => {
  const { video, id } = req.body;
  let thumbnail_path;
  const { currentUser } = req;

  const defaultVideo = await Video.findOne({ _id: id, role: 'admin' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (!defaultVideo) {
    return res.status(400).json({
      status: false,
      error: 'This Default video not exists',
    });
  }
  // Update Garbage
  const garbage = await garbageHelper.get(currentUser);
  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  if (garbage['edited_video']) {
    garbage['edited_video'].push(id);
  } else {
    garbage['edited_video'] = [id];
  }

  await garbage.save().catch((err) => {
    return res.status(400).json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in video) {
    defaultVideo[key] = video[key];
  }

  if (video.thumbnail) {
    // base 64 image
    const file_name = uuidv1();

    if (!fs.existsSync(THUMBNAILS_PATH)) {
      fs.mkdirSync(THUMBNAILS_PATH);
    }

    thumbnail_path = base64Img.imgSync(
      video.thumbnail,
      THUMBNAILS_PATH,
      file_name
    );
    if (fs.existsSync(thumbnail_path)) {
      fs.readFile(thumbnail_path, (err, data) => {
        if (err) {
          console.log('file read err', err.message || err.msg);
        } else {
          console.log('File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'thumbnail' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);

              thumbnail_path = upload.Location;
              if (thumbnail_path) {
                defaultVideo['thumbnail'] = thumbnail_path;
              }

              defaultVideo['updated_at'] = new Date();
              const defaultVideoJSON = JSON.parse(JSON.stringify(defaultVideo));
              delete defaultVideoJSON['_id'];
              delete defaultVideoJSON['role'];

              const newVideo = new Video({
                ...defaultVideoJSON,
                user: currentUser._id,
                default_video: id,
                default_edited: true,
              });

              const _video = await newVideo
                .save()
                .then()
                .catch((err) => {
                  console.log('video new creating err', err.message);
                });

              return res.send({
                status: true,
                data: _video,
              });
            }
          });
        }
      });

      // Thumbnail
      /**
      const play = await loadImage(PLAY_BUTTON_PATH);
    
      const canvas = createCanvas(250, 140)
      const ctx = canvas.getContext('2d');
      let image = await loadImage(thumbnail_path);
        
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
      ctx.fillText('Play video', 70, 120)
      ctx.drawImage(play, 10, 95, 40, 40)
      let buf = canvas.toBuffer();
      
      for(let i=0; i<30; i++){
        if(i<10){
          fs.writeFileSync(GIF_PATH+`frame-0${i}.png`, buf)
        } else {
          fs.writeFileSync(GIF_PATH+`frame-${i}.png`, buf)
        }
      }
       */
    } else {
      console.log('thumbnail writting server error');
      return res.status(400).json({
        status: false,
        error: 'thumbnail writing server error.',
      });
    }
  } else {
    defaultVideo['updated_at'] = new Date();
    const defaultVideoJSON = JSON.parse(JSON.stringify(defaultVideo));
    delete defaultVideoJSON['_id'];
    delete defaultVideoJSON['role'];

    const newVideo = new Video({
      ...defaultVideoJSON,
      user: currentUser._id,
      default_video: id,
      default_edited: true,
    });

    const _video = await newVideo
      .save()
      .then()
      .catch((err) => {
        console.log('video save err', err);
      });

    return res.send({
      status: true,
      data: _video,
    });
  }
  // if(!defaultVideo['preview']){
  //   const file_path = defaultVideo['path']
  //   defaultVideo['preview'] = await generatePreview(file_path).catch(err=>{
  //     console.log('err', err)
  //   })
  // }
};

const generatePreview = async (data) => {
  const { file_name, file_path, custom_thumbnail } = data;

  if (!fs.existsSync(GIF_PATH)) {
    fs.mkdirSync(GIF_PATH);
  }

  return new Promise(async (resolve, reject) => {
    const offsets = [];
    for (let i = 1000; i < 5000; i += 100) {
      offsets.push(i);
    }

    await extractFrames({
      input: file_path,
      output: GIF_PATH + `screenshot-${file_name}-%i.jpg`,
      offsets,
    }).catch((err) => {
      console.log('err', err);
    });

    const play = await loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );

    for (let i = 1; i < 40; i++) {
      const image = await loadImage(
        GIF_PATH + `screenshot-${file_name}-${i}.jpg`
      ).catch((err) => {
        console.log('screenshot generating error', err);
      });

      if (!image) {
        break;
      }

      let height = image.height;
      let width = image.width;

      if (height > width) {
        ctx.rect(
          0,
          0,
          system_settings.THUMBNAIL.WIDTH,
          system_settings.THUMBNAIL.HEIGHT
        );
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
        height = system_settings.THUMBNAIL.HEIGHT;
        ctx.drawImage(
          image,
          (system_settings.THUMBNAIL.WIDTH - width) / 2,
          0,
          width,
          height
        );
      } else {
        height = system_settings.THUMBNAIL.HEIGHT;
        width = system_settings.THUMBNAIL.WIDTH;
        ctx.drawImage(image, 0, 0, width, height);
      }

      // ctx.rect(70, 170, 200, 40);
      // ctx.globalAlpha = 0.7;
      // ctx.fillStyle = '#333';
      // ctx.fill();
      // ctx.globalAlpha = 1.0;
      // ctx.font = '24px Arial';
      // ctx.fillStyle = '#ffffff';
      // ctx.fillText('Play video', 80, 200);
      ctx.drawImage(play, 10, 150);

      const buf = canvas.toBuffer();

      if (custom_thumbnail) {
        fs.writeFileSync(GIF_PATH + `${file_name}-${i + 19}.png`, buf);
      } else {
        if (i < 10) {
          fs.writeFileSync(GIF_PATH + `${file_name}-0${i}.png`, buf);
        } else {
          fs.writeFileSync(GIF_PATH + `${file_name}-${i}.png`, buf);
        }
      }
    }

    const stream = pngFileStream(GIF_PATH + `${file_name}-??.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH + file_name));

    stream.on('finish', () => {
      if (fs.existsSync(GIF_PATH + file_name)) {
        fs.readFile(GIF_PATH + file_name, (err, data) => {
          if (err) {
            console.log('stream file error', err);
          }
          console.log('Gif File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'gif' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) throw s3Err;
            console.log(`Gif File uploaded successfully at ${upload.Location}`);

            fs.unlinkSync(GIF_PATH + file_name);
            resolve(upload.Location);
          });
        });
      }
    });
    stream.on('error', (err) => {
      console.log('err', err);
      reject(err);
    });
  });
};

const regeneratePreview = async (data) => {
  const { file_name } = data;

  if (!fs.existsSync(GIF_PATH)) {
    fs.mkdirSync(GIF_PATH);
  }

  return new Promise(async (resolve, reject) => {
    const play = await loadImage(PLAY_BUTTON_PATH);

    const canvas = createCanvas(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(
      system_settings.THUMBNAIL.WIDTH,
      system_settings.THUMBNAIL.HEIGHT
    );

    if (fs.existsSync(GIF_PATH + `screenshot-${file_name}-1.jpg`)) {
      for (let i = 1; i < 40; i++) {
        const image = await loadImage(
          GIF_PATH + `screenshot-${file_name}-${i}.jpg`
        );

        let height = image.height;
        let width = image.width;
        if (height > width) {
          ctx.rect(
            0,
            0,
            system_settings.THUMBNAIL.WIDTH,
            system_settings.THUMBNAIL.HEIGHT
          );
          ctx.fillStyle = '#000000';
          ctx.fill();
          width = (system_settings.THUMBNAIL.HEIGHT * width) / height;
          height = system_settings.THUMBNAIL.HEIGHT;
          ctx.drawImage(
            image,
            (system_settings.THUMBNAIL.WIDTH - width) / 2,
            0,
            width,
            height
          );
        } else {
          height = system_settings.THUMBNAIL.HEIGHT;
          width = system_settings.THUMBNAIL.WIDTH;
          ctx.drawImage(image, 0, 0, width, height);
        }
        // ctx.rect(70, 170, 200, 40);
        // ctx.globalAlpha = 0.7;
        // ctx.fillStyle = '#333';
        // ctx.fill();
        // ctx.globalAlpha = 1.0;
        // ctx.font = '24px Arial';
        // ctx.fillStyle = '#ffffff';
        // ctx.fillText('Play video', 80, 200);
        ctx.drawImage(play, 10, 150);

        const buf = canvas.toBuffer();
        fs.writeFileSync(GIF_PATH + `${file_name}-${i + 19}.png`, buf);
      }
    }

    const stream = pngFileStream(GIF_PATH + `${file_name}-??.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH + file_name));

    stream.on('finish', () => {
      if (fs.existsSync(GIF_PATH + file_name)) {
        fs.readFile(GIF_PATH + file_name, (err, data) => {
          if (err) {
            console.log('stream file error', err);
          }
          console.log('Gif File read was successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'gif' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) throw s3Err;
            console.log(`Gif File uploaded successfully at ${upload.Location}`);

            fs.unlinkSync(GIF_PATH + file_name);
            resolve(upload.Location);
          });
        });
      }
    });
    stream.on('error', (err) => {
      console.log('err', err);
      reject(err);
    });
  });
};

const get = async (req, res) => {
  const video = await Video.findOne({ _id: req.params.id, del: false });
  const user = await User.findOne({ _id: video.user });
  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(video);
  const data = JSON.parse(myJSON);
  Object.assign(data, { user });

  res.send({
    status: true,
    data,
  });
};

const getThumbnail = (req, res) => {
  const filePath = THUMBNAILS_PATH + req.params.name;

  if (fs.existsSync(filePath)) {
    if (req.query.resize) {
      const readStream = fs.createReadStream(filePath);
      let transform = sharp();
      transform = transform.resize(250, 140);
      return readStream.pipe(transform).pipe(res);
    } else {
      const contentType = mime.contentType(path.extname(req.params.name));
      res.set('Content-Type', contentType);
      return res.sendFile(filePath);
    }
  } else {
    return res.status(404).send({
      status: false,
      error: 'Thumbnail does not exist',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);
  let editedVideos = [];
  if (garbage && garbage['edited_video']) {
    editedVideos = garbage['edited_video'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _video_list = await Video.find({ user: currentUser.id, del: false })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  const _video_admin = await Video.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedVideos },
    company,
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });

  Array.prototype.push.apply(_video_list, _video_admin);

  const teams = await Team.find({ members: currentUser.id }).populate('videos');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(_video_list, team.videos);
    }
  }

  if (!_video_list) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist',
    });
  }
  const _video_detail_list = [];

  for (let i = 0; i < _video_list.length; i++) {
    const _video_detail = await VideoTracker.aggregate([
      {
        $lookup: {
          from: 'videos',
          localField: 'video',
          foreignField: '_id',
          as: 'video_detail',
        },
      },
      {
        $match: {
          video: _video_list[i]._id,
          user: currentUser._id,
        },
      },
    ]);

    const myJSON = JSON.stringify(_video_list[i]);
    const _video = JSON.parse(myJSON);
    const video_detail = await Object.assign(_video, {
      views: _video_detail.length,
    });
    _video_detail_list.push(video_detail);
  }

  return res.send({
    status: true,
    data: _video_detail_list,
  });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: currentUser.id,
    });

    if (video) {
      if (video['default_edited']) {
        Garbage.updateOne(
          { user: currentUser.id },
          {
            $pull: { edited_video: { $in: [video.default_video] } },
          }
        ).catch((err) => {
          console.log('default video remove err', err.message);
        });
      } else {
        const url = video.url;
        if (url.indexOf('teamgrow.s3') > 0) {
          s3.deleteObject(
            {
              Bucket: api.AWS.AWS_S3_BUCKET_NAME,
              Key: url.slice(44),
            },
            function (err, data) {
              console.log('err', err);
            }
          );
        } else {
          try {
            const file_path = video.path;
            if (file_path) {
              fs.unlinkSync(file_path);
            }
          } catch (err) {
            console.log('err', err);
          }
        }
      }

      video['del'] = true;
      video.save().catch((err) => {
        console.log('err', err.message);
      });
      return res.send({
        status: true,
      });
    } else {
      res.status(400).send({
        status: false,
        error: 'There is no video.',
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({
      status: false,
      error: 'internal_server_error',
    });
  }
};

const getHistory = async (req, res) => {
  const { currentUser } = req;
  const _activity_list = await Activity.aggregate([
    {
      $lookup: {
        from: 'contacts',
        localField: 'contacts',
        foreignField: '_id',
        as: 'video_detail',
      },
    },
    {
      $match: { video: req.params.id, user: currentUser.id },
    },
  ]);
  for (let i = 0; i < _activity_list.length; i++) {
    const _video_tracker = VideoTracker.find({
      contact: _activity_list[i].contact,
      video: req.params.id,
      user: currentUser.id,
    });
    _activity_list[i].video_tracker = _video_tracker;
  }
  if (_activity_list) {
    res.send({
      status: true,
      data: {
        data: _activity_list,
      },
    });
  } else {
    res.status(404).send({
      status: false,
      error: 'Activity not found',
    });
  }
};

const bulkEmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'contact email not found or unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('video found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'] + '?resize=true';
        }

        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = `${video.title}`;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
        const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: video_subject,
        html:
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          video_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          emailHelper.generateUnsubscribeLink(activity.id) +
          '</body></html>',
        text: video_content,
      };

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then(async (_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              email_count += 1;
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('contact update err', err.message);
              });
              resolve();
            } else {
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err.message);
              });
              console.log('email sending err', msg.to + res[0].statusCode);
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  email: _contact.email,
                },
                err: _res[0].statusCode,
              });
            }
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('email sending err', msg.to);
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err,
            });
            resolve();
          });
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });

        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('email sending err', err);
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const bulkGmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      return res.status(406).send({
        status: false,
        error: 'not connected',
      });
    });

    let email_count = currentUser['email_info']['count'] || 0;
    let no_connected = false;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'Contact email is unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('vidoe found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'];
        }
        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = video.title;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
        const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}" alt="Preview image went something wrong. Please click here"/></a><br/></p>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const email_content =
        '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
        video_content +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';

      // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );

      promise = new Promise((resolve, reject) => {
        // gmail.users.messages.send({
        //   'auth': oauth2Client,
        //   'userId': 'me',
        //   'resource': {
        //     raw: rawContent
        //   }
        // }, (err, response) => {
        //   if(err) {
        //     Activity.deleteOne({_id: activity.id}).catch(err=>{
        //       console.log('err', err)
        //     })
        //     console.log('err', err.response['statusText'])
        //     error.push({
        //       contact: {
        //         id: contacts[i],
        //         first_name: _contact.first_name,
        //         email: _contact.email,
        //       },
        //       err: err.response['statusText']
        //     })
        //     resolve();
        //   } else {
        //     Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
        //       console.log('err', err)
        //     })
        //     resolve()
        //   }
        // });

        try {
          const body = createBody({
            headers: {
              To: _contact.email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: video_subject,
            },
            textHtml: email_content,
            textPlain: email_content,
          });
          request({
            method: 'POST',
            uri:
              'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
            headers: {
              Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
              'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
            },
            body,
          })
            .then(() => {
              email_count += 1;
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('err', err);
              });
              resolve();
            })
            .catch((err) => {
              console.log('gmail video send err', err.message);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err.message);
              });
              if (err.statusCode === 403) {
                no_connected = true;
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  err: 'No Connected Gmail',
                });
              } else if (err.statusCode === 400) {
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  err: err.message,
                });
              } else {
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    email: _contact.email,
                  },
                  err: 'Recipient address required',
                });
              }
              resolve();
            });
        } catch (err) {
          console.log('gmail video send err', err.message);
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err.message);
          });
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: err.message,
          });
          resolve();
        }
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });

        if (no_connected) {
          return res.status(406).send({
            status: false,
            error: 'no connected',
          });
        }
        if (error.length > 0) {
          return res.status(405).send({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const bulkText = async (req, res) => {
  const { currentUser } = req;
  const { content, videos: videoIds, contacts } = req.body;
  const promise_array = [];
  const error = [];

  const videos = await Video.find({ _id: { $in: videoIds } });

  let detail_content = 'sent video using sms';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  if (contacts) {
    if (contacts.length > system_settings.TEXT_MONTHLY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.TEXT_MONTHLY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
        (err) => {
          console.log('err', err);
        }
      );
      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < videos.length; j++) {
        const video = videos[j];

        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_content = video_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

        if (j < videos.length - 1) {
          video_titles = video_titles + video.title + ', ';
          video_descriptions += `${video.description}, `;
        } else {
          video_titles += video.title;
          video_descriptions += video.description;
        }
        const video_object = `\n${video.title}:\n\n${video_link}\n`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '\n' + video_objects;
      }

      if (video_content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (video_content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      let fromNumber = currentUser['proxy_number'];

      if (!fromNumber) {
        fromNumber = await textHelper.getTwilioNumber(currentUser.id);
      }
      const promise = new Promise((resolve, reject) => {
        const e164Phone = phone(_contact.cell_phone)[0];
        if (!e164Phone) {
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('activity delete err', err.message);
          });
          error.push({
            contact: {
              first_name: _contact.first_name,
              cell_phone: _contact.cell_phone,
            },
            err: 'Invalid phone number',
          });
          resolve(); // Invalid phone number
        }
        twilio.messages
          .create({ from: fromNumber, body: video_content, to: e164Phone })
          .then(() => {
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              video_content
            );
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve();
          })
          .catch((err) => {
            console.log('err', err);
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              err,
            });
            resolve();
          });
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const createSmsContent = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;

  const _contact = await Contact.findOne({ _id: contacts[0] }).catch((err) => {
    console.log('err', err);
  });

  let video_titles = '';
  let video_descriptions = '';
  let video_objects = '';
  const video_subject = '';
  let video_content = content;
  let activity;

  for (let j = 0; j < videos.length; j++) {
    const video = videos[j];

    if (typeof video_content === 'undefined') {
      video_content = '';
    }

    video_content = video_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const _activity = new Activity({
      content: 'sent video using sms',
      contacts: contacts[0],
      user: currentUser.id,
      type: 'videos',
      videos: video._id,
      created_at: new Date(),
      updated_at: new Date(),
      description: video_content,
    });

    activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });

    const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

    if (j < videos.length - 1) {
      video_titles = video_titles + video.title + ', ';
      video_descriptions += `${video.description}, `;
    } else {
      video_titles += video.title;
      video_descriptions += video.description;
    }
    const video_object = `\n${video.title}:\n${video_link}\n`;
    video_objects += video_object;
  }

  if (video_content.search(/{video_object}/gi) !== -1) {
    video_content = video_content.replace(/{video_object}/gi, video_objects);
  } else {
    video_content += video_objects;
  }

  if (video_content.search(/{video_title}/gi) !== -1) {
    video_content = video_content.replace(/{video_title}/gi, video_titles);
  }

  if (video_content.search(/{video_description}/gi) !== -1) {
    video_content = video_content.replace(
      /{video_description}/gi,
      video_descriptions
    );
  }

  return res.send({
    status: true,
    data: video_content,
  });
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, videos, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent video using email';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err', err.message);
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        promise = new Promise(async (resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'contact email not found or unsubscribed',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }
      const email_info = currentUser['email_info'];
      if (email_info['is_limit'] && email_count > max_email_count) {
        promise = new Promise((resolve, reject) => {
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err: 'email daily limit exceed!',
          });
          resolve();
        });
        promise_array.push(promise);
        continue;
      }

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let video_titles = '';
      let video_descriptions = '';
      let video_objects = '';
      let video_subject = subject;
      let video_content = content;
      const activities = [];
      let activity;

      for (let j = 0; j < videos.length; j++) {
        const video = await Video.findOne({ _id: videos[j] }).catch((err) => {
          console.log('video found err', err.message);
        });
        let preview;
        if (video['preview']) {
          preview = video['preview'];
        } else {
          preview = video['thumbnail'];
        }

        if (typeof video_content === 'undefined') {
          video_content = '';
        }

        video_subject = video_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        video_content = video_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: video_subject,
          description: video_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = `${video.title}`;
        }

        if (j < videos.length - 1) {
          video_descriptions += `${video.description}, `;
        } else {
          video_descriptions += video.description;
        }
        const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
        // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
        const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
        video_objects += video_object;
        activities.push(activity.id);
      }

      if (video_subject === '') {
        video_subject = 'VIDEO: ' + video_titles;
      } else {
        video_subject = video_subject.replace(/{video_title}/gi, video_titles);
        video_subject = video_subject.replace(
          /{material_title}/gi,
          video_titles
        );
      }

      if (video_content.search(/{video_object}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_object}/gi,
          video_objects
        );
      } else {
        video_content = video_content + '<br/>' + video_objects;
      }

      if (content.search(/{video_title}/gi) !== -1) {
        video_content = video_content.replace(/{video_title}/gi, video_titles);
      }

      if (content.search(/{video_description}/gi) !== -1) {
        video_content = video_content.replace(
          /{video_description}/gi,
          video_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: video_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
              video_content +
              '<br/>Thank you,<br/>' +
              currentUser.email_signature +
              emailHelper.generateUnsubscribeLink(activity.id) +
              '</body></html>',
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            email_count += 1;
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve();
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('err', err.message);
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: err.message || err.msg,
            });
            resolve();
          });
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        currentUser['email_info']['count'] = email_count;
        currentUser.save().catch((err) => {
          console.log('current user save err', err.message);
        });
        if (error.length > 0) {
          return res.status(405).json({
            status: false,
            error,
          });
        }
        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('err', err);
        if (err) {
          return res.status(400).json({
            status: false,
            error: err,
          });
        }
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const makeBody = (to, from, subject, message) => {
  var str = [
    'Content-Type: text/html; charset="UTF-8"\n',
    'MIME-Version:1.0\n',
    'Content-Transfer-Encoding: 7bit\n',
    'to: ',
    to,
    '\n',
    'from: ',
    from,
    '\n',
    'subject: ',
    subject,
    '\n\n',
    message,
  ].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
};

const getConvertStatus = async (req, res) => {
  // const video = await Video.findOne({_id: req.params.id}).catch(err=>{
  //   console.log('video convert found video error', err.message)
  // })
  // const file_path = video['path']
  const { videos } = req.body;
  const result_array = {};
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const result = videoHelper.getConvertStatus(video);
    result_array[video] = result;
  }
  return res.send(result_array);
};

module.exports = {
  play,
  play1,
  embedPlay,
  pipe,
  create,
  update,
  updateDetail,
  updateDefault,
  get,
  getThumbnail,
  getAll,
  getConvertStatus,
  bulkEmail,
  bulkText,
  remove,
  getHistory,
  createVideo,
  createSmsContent,
  bulkGmail,
  bulkOutlook,
};
