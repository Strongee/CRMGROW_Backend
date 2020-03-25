const Page = require('../models/page')
const mongoose = require('mongoose')
const uuidv1 = require('uuid/v1');
const config = require('../config/config')
const AWS = require('aws-sdk')
AWS.config.update({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})
var s3 = new AWS.S3();


const loadDefault = async (req, res) => {
  const {currentUser} = req;
  const page = req.params.page;

  const templates = await Page.find( {default: true}).catch(err => {
    throw(err);
    return;
  });
  if(templates) {
    return res.send({
      status: true,
      data: templates,
      total: total
    })
  }
  else {
    return res.status(400).send({
      status: false,
      error: 'There are no templates'
    })
  }
}

const create =  async (req, res) => {
  const { currentUser } = req;
  const { meta } = req.body;
  if(meta.base64_image) {
    const base64Data = new Buffer.from(meta.base64_image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const type = meta.base64_image.split(';')[0].split('/')[1];
    let image_name = uuidv1();
    delete meta.base64_image
    var data = {
      Bucket: 'teamgrow',
      Key: `${image_name}.${type}`, 
      Body: base64Data,
      ContentEncoding: 'base64',
      ACL: 'public-read',
      ContentType: `image/${type}`
    };
    try {
      const { Location, Key } = await s3.upload(data).promise();      
      meta['image'] = Location;
    } catch (error) {
       console.log(error)
    }
  }

  const page = new Page({
        ...req.body,
        user: currentUser.id,
        created_at: new Date(),
        updated_at: new Date()
    })

  page.save().then(_page => {
    res.send({
      status: true,
      data: _page
    })
  }).catch(err => {
    res.status(500).send({
      status: false,
      error: err.message || 'Page creating is failed.'
    })
  })
}

const update = async (req, res) => {
  const id = req.params.id;
  const data = req.body;
  const { meta } = data;
  if(meta.base64_image) {
    if(meta.image) {
      var params = {  Bucket: 'teamgrow', Key: meta.image };
      try {
        await s3.deleteObject(data).promise();
        delete meta.image
      } catch (error) {
         console.log(error)
      }
    }

    const base64Data = new Buffer.from(meta.base64_image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    const type = meta.base64_image.split(';')[0].split('/')[1];
    let image_name = uuidv1();
    delete meta.base64_image
    var imageParam = {
      Bucket: 'teamgrow',
      Key: `${image_name}.${type}`, 
      Body: base64Data,
      ContentEncoding: 'base64',
      ACL: 'public-read',
      ContentType: `image/${type}`
    };
    try {
      const { Location, Key } = await s3.upload(imageParam).promise();      
      console.log("Location, key", Location, Key)
      meta['image'] = Location;
    } catch (error) {
       console.log(error)
    }
  }

  Page.find({_id: id}).update({$set: data}).then(() => {
    res.send({
      status: true
    })
  }).catch(err => {
    res.status(400).send({
      status: false,
      error: err.message || 'Page Updating is failed.'
    })
  })
}

const read = (req, res) => {
  const id = req.params.id;

  Page.findOne({_id: id}).then(data => {
    res.send({
      satus: true,
      data
    })
  }).catch(er => {
    res.status(500).send({
      status: false,
      error: err.message || 'Page reading is failed.'
    })
  })
}

const remove = async (req, res) => {
  await Page.deleteOne({_id: req.params.id}).catch(err => {
        req.status(400).send({
            status: false
        })
    })

    res.send({
        status: false
    })
}

const bulkRemove = async (req, res) => {
  const {ids} = req.body
  await Page.delete({_id: {$in: ids}}).catch(err => {
    req.status(400).send({
        status: false
    })
  })

  res.send({
      status: false
  })
}

const load = async (req, res) => {
  const {currentUser} = req;
  const page = req.params.page;

  const pages = await Page.find({user: currentUser.id}).skip((page-1)*10).limit(10).catch(err => {
    throw(err);
    return;
  });
  const total = await Page.countDocuments({
    user: currentUser.id
  })
  if(pages) {
    setTimeout(() => {
      
    return res.send({
      status: true,
      data: pages,
      total: total
    })
    }, 4000);
  }
  else {
    return res.status(400).send({
      status: false,
      error: 'There are no Pages'
    })
  }
}

const duplicate = (req, res) => {

}

const search = async(req, res) => {
    // const condition = req.body;
    // const { currentUser } = req;    
    // Automation.find(
    // {$and: [
    //     {
    //         $or: [
    //             {'user': currentUser.id,},
    //             {'role': 'admin'}
    //           ]
    //         },
    //     {
    //         'title': { '$regex': '.*' + condition.search + '.*', '$options': 'i' }
    //     }
    // ]}).then((data) => {
    //     return res.send({
    //         status: true,
    //         data
    //     })
    // }).catch(err => {
    //         req.status(400).send({
    //             status: false
    //         })
    //     })    
}


module.exports = {
  create,
  read,
  update,
  remove,
  load,
  bulkRemove,
  search,
  duplicate,
  loadDefault
}