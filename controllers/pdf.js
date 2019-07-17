const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const User = require('../models/user')
const Activity = require('../models/activity')
const PDF = require('../models/pdf')
const PDFTracker = require('../models/pdf_tracker')
const { PREVIEW_PATH } = require('../config/path')
const urls = require('../constants/urls')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')
const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')
const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const create = async (req, res) => {
  if (req.file) {
      if(req.currentUser){
        const pdf = new PDF({
          user: req.currentUser.id,
          type: req.file.mimetype,
          url: req.file.location,
          role: 'user',
          created_at: new Date()
        })

        pdf.save().then((_pdf)=>{
          res.send({
            status: true,
            data: _pdf
          })
        })
    }
  }
}

const updateDetail = async (req, res) => {
  const {currentUser} = req
  if (req.body.preview) { // base 64 image
    const editData = req.body
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.preview, PREVIEW_PATH, file_name)
      const pdf = await PDF.findOne({user: currentUser.id, _id: req.params.id})

      console.log('pdf', pdf)
      if (!pdf) {
        return res.status(401).json({
          status: false,
          error: 'Invalid_permission'
        })
      }

      for (let key in editData) {
        pdf[key] = editData[key]
      }

      pdf['preview'] = urls.PDF_PREVIEW_URL + path.basename(file_path) 

      pdf["updated_at"] = new Date()

      pdf.save().then((_pdf)=>{
        res.send({
          status: true,
          data: _pdf
        })
      })

  }else{
    res.status(401).json({
      status: false,
      error: 'Not_found_preview'
    })
  }
}


const get = async (req, res) => {
  const pdf = await PDF.findOne({_id: req.params.id})
  const user = await User.findOne({_id: pdf.user})
    if (!pdf) {
      return res.status(401).json({
        status: false,
        error: 'PDF doesn`t exist'
      })
    }
    myJSON = JSON.stringify(pdf)
    const data = JSON.parse(myJSON);
    Object.assign(data, {"user": user})

  res.send({
    status: true,
    data
  })

}

const getPreview = (req, res) => {
  const filePath = PREVIEW_PATH + req.params.name
  console.info('File Path:', filePath)
  if (fs.existsSync(filePath)) {
    const contentType = mime.contentType(path.extname(req.params.name))
    res.set('Content-Type', contentType)
    res.sendFile(filePath)
  } else {
    res.status(404).send({
      status: false,
      error: 'Preview does not exist'
    })
  }
}

const getAll = async (req, res) => {
  const {currentUser} = req
  let _pdf_list = await PDF.find({user: currentUser.id})
  let _pdf_admin = await PDF.find({role: "admin"})
  Array.prototype.push.apply(_pdf_list, _pdf_admin)

  console.log('_pdf_list', _pdf_list)
  if (!_pdf_list) {
    return res.status(401).json({
      status: false,
      error: 'PDF doesn`t exist'
    })
  }
  let _pdf_detail_list = [];

  for(let i = 0; i < _pdf_list.length; i ++){
    const _pdf_detail = await PDFTracker.aggregate([
        {
          $lookup:
            {
            from:  'pdfs',
            localField: 'pdf',
            foreignField: '_id',
            as: "pdf_detail"
            }
        },
        {
          $match: { "pdf": _pdf_list[i]._id }
        }
    ])

    myJSON = JSON.stringify(_pdf_list[i])
    const _pdf = JSON.parse(myJSON);
    const pdf_detail = await Object.assign(_pdf, {"views": _pdf_detail.length})
    _pdf_detail_list.push(pdf_detail)
  }

  res.send({
    status: true,
    data: _pdf_detail_list
  })
}

const sendPDF = async (req, res) => {
  const { currentUser } = req
  const {email, content, pdf, pdf_title, contact, activity, contact_name} = req.body
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const pdf_link =urls.MATERIAL_VIEW_PDF_URL + '?pdf=' + pdf + '&contact=' + contact + '&user=' + currentUser.id + '&activity=' + activity
  const msg = {
    to: email,
    from: currentUser.email,
    subject: pdf_title,
    html: '<html><head><title>PDF Invitation</title></head><body>Hi '+ contact_name.charAt(0).toUpperCase() + contact_name.slice(1) + 
          ',<br/><p>' + content + '</p> <p>Please click on the pdf link below to learn more!</p><a href="' + pdf_link + '">'+ pdf_title + 
          '</a><br/><br/>Thank you<br/><br/>'+ currentUser.email_signature+'</body></html>'
  }

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      const _activity = new Activity({
        content: currentUser.user_name + ' sent pdf using email',
        contacts: contact,
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf,
        created_at: new Date(),
        updated_at: new Date(),
      })     
      _activity.save()
      res.send({
        status: true,
      })        
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
}

const sendText = async (req, res) => {
  const { currentUser } = req
  const { cell_phone, content, pdf, activity, contact} = req.body

  const pdf_link =urls.MATERIAL_VIEW_PDF_URL + '?pdf=' + pdf + '&contact=' + contact + '&user=' + currentUser.id + '&activity=' + activity
  const e164Phone = phone(cell_phone)[0]
  const fromNumber = config.TWILIO.TWILIO_NUMBER
  console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content)

  if (!e164Phone) {
    const error = {
      error: 'Invalid Phone Number'
    }

    throw error // Invalid phone number
  }

    const body = content + ' ' + pdf_link
  
    await twilio.messages.create({from: fromNumber, body: body,  to: e164Phone})
    
    const _activity = new Activity({
          content: currentUser.user_name + ' sent pdf using sms',
          contacts: contact,
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf,
          created_at: new Date(),
          updated_at: new Date(),
        })
    
        _activity.save()
        res.send({
            status: true,
          })
           
}

const remove = async (req, res) => {
    const { currentUser } = req
    try {
      const pdf = PDF.findOne({ user: currentUser.id, _id: req.params.id})
  
      if (pdf) {
        fs.unlinkSync(PREVIEW_PATH + req.params.id)
        res.send({
          status: true,
          data: {
            file_name: req.params.id
          }
        })
      } else {
        res.status(404).send({
          status: false,
          error: 'preview_not_found'
        })
      }
    } catch (e) {
      console.error(e)
      res.status(500).send({
        status: false,
        error: 'internal_server_error'
      })
    }
}

const getHistory = async(req, res) => {
  const { currentUser } = req
  const _activity_list = await Activity.aggregate([
    {
      $lookup:
        {
        from:  'contacts',
        localField: 'contacts',
        foreignField: '_id',
        as: "pdf_detail"
        }
    },
    {
      $match: { "pdf": req.params.id, "user": currentUser.id}
    }
  ])
  for(let i = 0; i < _activity_list.length; i ++){
    const _pdf_tracker = PDFTracker.find({contact: _activity_list[i].contact, pdf: req.params.id, user: currentUser.id})
    _activity_list[i].pdf_tracker = _pdf_tracker;
  }
  if (_activity_list) {
    res.send({
      status: true,
      data: {
        data: _activity_list
      }
    })
  } else {
    res.status(404).send({
      status: false,
      error: 'Activity not found'
    })
  }
}

module.exports = {
  create,
  updateDetail,
  get,
  getAll,
  getPreview,
  sendPDF,
  sendText,
  remove,
  getHistory
}