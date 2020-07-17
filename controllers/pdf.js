const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const base64Img = require('base64-img');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');
const phone = require('phone');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const nodemailer = require('nodemailer');
const Garbage = require('../models/garbage');
const Team = require('../models/team');
const garbageHelper = require('../helpers/garbage.js');
var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');

const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const { PREVIEW_PATH } = require('../config/path');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const User = require('../models/user');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

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
const textHelper = require('../helpers/text');
const emailHelper = require('../helpers/email');
const AssistantHelper = require('../helpers/assistant');

const play = async (req, res) => {
  const pdf_id = req.query.pdf;
  const sender_id = req.query.user;
  const pdf = await PDF.findOne({ _id: pdf_id });
  const sender = await User.findOne({ _id: sender_id, del: false });

  if (sender) {
    const pattern = /^((http|https|ftp):\/\/)/;

    if (!pattern.test(sender.learn_more)) {
      sender.learn_more = 'http://' + sender.learn_more;
    }
    res.render('pdf', {
      pdf,
      user: sender,
    });
  } else {
    res.send(
      'Sorry! This pdf link is expired for some reason. Please try ask to sender to send again.'
    );
  }
};

const play1 = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id })
    .populate([{ path: 'user' }, { path: 'pdfs' }])
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

    const pattern = /^((http|https|ftp):\/\/)/;

    if (!pattern.test(user.learn_more)) {
      user.learn_more = 'http://' + user.learn_more;
    }

    const pdf = activity['pdfs'];

    res.render('pdf1', {
      pdf,
      user,
      contact: activity['contacts'],
      activity: activity.id,
    });
  }
};

const create = async (req, res) => {
  if (req.file) {
    if (req.currentUser) {
      const pdf = new PDF({
        user: req.currentUser.id,
        type: req.file.mimetype,
        url: req.file.location,
        role: 'user',
        created_at: new Date(),
      });

      pdf.save().then((_pdf) => {
        res.send({
          status: true,
          data: _pdf,
        });
      });
    }
  }
};

const updateDetail = async (req, res) => {
  const editData = { ...req.body };
  delete editData.preview;
  const { currentUser } = req;
  const pdf = await PDF.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('pdf found err', err.message);
  });

  if (!pdf) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission',
    });
  }
  if (req.body.preview) {
    try {
      const today = new Date();
      const year = today.getYear();
      const month = today.getMonth();
      const preview_image = await uploadBase64Image(
        req.body.preview,
        'preview' + year + '/' + month
      );
      pdf['preview'] = preview_image;
    } catch (error) {
      console.error('Upload PDF Preview Image', error);
    }
  }

  for (const key in editData) {
    pdf[key] = editData[key];
  }

  pdf['updated_at'] = new Date();
  pdf
    .save()
    .then((_pdf) => {
      return res.send({
        status: true,
        data: _pdf,
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
  const { pdf, id } = req.body;
  let preview_path;
  const { currentUser } = req;

  const defaultPDF = await PDF.findOne({ _id: id, role: 'admin' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (!defaultPDF) {
    return res.status(400).json({
      status: false,
      error: 'This Default PDF does not exist',
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

  if (garbage['edited_pdf']) {
    garbage['edited_pdf'].push(id);
  } else {
    garbage['edited_pdf'] = [id];
  }

  await garbage.save().catch((err) => {
    return res.status(400).json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in pdf) {
    defaultPDF[key] = pdf[key];
  }

  if (pdf.preview) {
    // base 64 image
    const file_name = uuidv1();

    if (!fs.existsSync(PREVIEW_PATH)) {
      fs.mkdirSync(PREVIEW_PATH);
    }

    preview_path = base64Img.imgSync(pdf.preview, PREVIEW_PATH, file_name);
    if (fs.existsSync(preview_path)) {
      fs.readFile(preview_path, (err, data) => {
        if (err) {
          console.log('File read error', err.message || err.msg);
        } else {
          console.log('File read done successful', data);
          const today = new Date();
          const year = today.getYear();
          const month = today.getMonth();
          const params = {
            Bucket: api.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
            Key: 'preview' + year + '/' + month + '/' + file_name,
            Body: data,
            ACL: 'public-read',
          };
          s3.upload(params, async (s3Err, upload) => {
            if (s3Err) {
              console.log('upload s3 error', s3Err);
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`);

              preview_path = upload.Location;
              if (preview_path) {
                defaultPDF['preview'] = preview_path;
              }

              defaultPDF['updated_at'] = new Date();
              const defaultPdfJSON = JSON.parse(JSON.stringify(defaultPDF));
              delete defaultPdfJSON['_id'];
              delete defaultPdfJSON['role'];

              const newPDF = new PDF({
                ...defaultPdfJSON,
                user: currentUser._id,
                default_pdf: id,
                default_edited: true,
              });

              const _pdf = await newPDF
                .save()
                .then()
                .catch((err) => {
                  console.log('pdf new creating err', err.message);
                });

              return res.send({
                status: true,
                data: _pdf,
              });
            }
          });
        }
      });
    } else {
      console.log('preview writting server error');
      return res.status(400).json({
        status: false,
        error: 'preview writing server error.',
      });
    }
  } else {
    defaultPDF['updated_at'] = new Date();
    const defaultPdfJSON = JSON.parse(JSON.stringify(defaultPDF));
    delete defaultPdfJSON['_id'];
    delete defaultPdfJSON['role'];

    const newPDF = new PDF({
      ...defaultPdfJSON,
      user: currentUser._id,
      default_pdf: id,
      default_edited: true,
    });

    const _pdf = await newPDF
      .save()
      .then()
      .catch((err) => {
        console.log('pdf save err', err);
      });

    return res.send({
      status: true,
      data: _pdf,
    });
  }
  pdf.save().then((_pdf) => {
    return res.send({
      status: true,
      data: _pdf,
    });
  });
};

const get = async (req, res) => {
  const pdf = await PDF.findOne({ _id: req.params.id });
  const user = await User.findOne({ _id: pdf.user });
  if (!pdf) {
    return res.status(400).json({
      status: false,
      error: 'PDF doesn`t exist',
    });
  }
  const myJSON = JSON.stringify(pdf);
  const data = JSON.parse(myJSON);
  Object.assign(data, { user });

  res.send({
    status: true,
    data,
  });
};

const getPreview = (req, res) => {
  const filePath = PREVIEW_PATH + req.params.name;

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
    res.status(404).send({
      status: false,
      error: 'Preview does not exist',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);
  let editedPDFs = [];
  if (garbage && garbage['edited_pdf']) {
    editedPDFs = garbage['edited_pdf'];
  }

  // const company = currentUser.company || 'eXp Realty';
  const _pdf_list = await PDF.find({ user: currentUser.id, del: false }).sort({
    created_at: 1,
  });
  const _pdf_admin = await PDF.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedPDFs },
  }).sort({
    created_at: 1,
  });
  Array.prototype.push.apply(_pdf_list, _pdf_admin);

  const teams = await Team.find({ members: currentUser.id }).populate('pdfs');

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(_pdf_list, team.pdfs);
    }
  }

  if (!_pdf_list) {
    return res.status(400).json({
      status: false,
      error: 'PDF doesn`t exist',
    });
  }
  const _pdf_detail_list = [];

  for (let i = 0; i < _pdf_list.length; i++) {
    const _pdf_detail = await PDFTracker.aggregate([
      {
        $lookup: {
          from: 'pdfs',
          localField: 'pdf',
          foreignField: '_id',
          as: 'pdf_detail',
        },
      },
      {
        $match: {
          pdf: _pdf_list[i]._id,
          user: currentUser._id,
        },
      },
    ]);

    // const view = await PDFTracker.countDocuments({
    //   pdf: _pdf_list[i]._id,
    //   user: currentUser._id,
    // });

    const myJSON = JSON.stringify(_pdf_list[i]);
    const _pdf = JSON.parse(myJSON);
    const pdf_detail = await Object.assign(_pdf, { views: _pdf_detail.length });
    _pdf_detail_list.push(pdf_detail);
  }

  return res.send({
    status: true,
    data: _pdf_detail_list,
  });
};

const sendPDF = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdf, pdf_title, pdf_prview, contacts } = req.body;

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] });
      const sendContent = content.replace(
        /{first_name}/gi,
        _contact.first_name
      );
      const _activity = new Activity({
        content: 'sent pdf using email',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf,
        created_at: new Date(),
        updated_at: new Date(),
        subject,
        description: sendContent,
      });
      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contacts[i] },
        {
          $set: { last_activity: activity.id },
        }
      ).catch((err) => {
        console.log('err', err);
      });
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${currentUser.connected_email}>`,
        subject: subject || pdf_title,
        html:
          '<html><head><title>PDF Invitation</title></head><body><p style="white-space: pre-wrap; max-width: 800px;">' +
          sendContent +
          '</p><a href="' +
          pdf_link +
          '">' +
          '<img src=' +
          pdf_prview +
          '?resize=true"></img>' +
          '</a><br/><br/>Thank you<br/><br/>' +
          currentUser.email_signature +
          '</body></html>',
      };

      sgMail
        .send(msg)
        .then((_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            console.log('status', _res[0].statusCode);
          } else {
            console.log('email sending err', msg.to + res[0].statusCode);
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const sendText = async (req, res) => {
  const { currentUser } = req;
  const { content, pdf, pdf_title, contacts } = req.body;

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] });
      const sendContent = content.replace(
        /{first_name}/gi,
        _contact.first_name
      );
      const cell_phone = _contact.cell_phone;
      const _activity = new Activity({
        content: 'sent pdf using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf,
        created_at: new Date(),
        updated_at: new Date(),
        description: sendContent,
      });

      const activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contacts[i] },
        {
          $set: { last_activity: activity.id },
        }
      ).catch((err) => {
        console.log('err', err);
      });

      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
      const e164Phone = phone(cell_phone)[0];
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number',
        };

        throw error; // Invalid phone number
      }

      let fromNumber = currentUser['proxy_number'];

      if (!fromNumber) {
        const areaCode = currentUser.cell_phone.substring(1, 4);

        const data = await twilio.availablePhoneNumbers('US').local.list({
          areaCode,
        });

        let number = data[0];

        if (typeof number === 'undefined') {
          const areaCode1 = currentUser.cell_phone.substring(1, 3);

          const data1 = await twilio.availablePhoneNumbers('US').local.list({
            areaCode: areaCode1,
          });
          number = data1[0];
        }

        if (typeof number !== 'undefined') {
          const proxy_number = await twilio.incomingPhoneNumbers.create({
            phoneNumber: number.phoneNumber,
            smsUrl: urls.SMS_RECEIVE_URL,
          });

          console.log('proxy_number', proxy_number);
          currentUser['proxy_number'] = proxy_number.phoneNumber;
          fromNumber = currentUser['proxy_number'];
          currentUser.save().catch((err) => {
            console.log('err', err);
          });
        } else {
          fromNumber = api.TWILIO.TWILIO_NUMBER;
        }
      }
      console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content);

      const body = sendContent + '\n\n' + pdf_title + '\n\n' + pdf_link;

      twilio.messages
        .create({ from: fromNumber, body, to: e164Phone })
        .then(() => {
          console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content);
        })
        .catch((err) => {
          console.log('err', err);
        });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const pdf = await PDF.findOne({ _id: req.params.id, user: currentUser.id });

    if (pdf) {
      if (pdf['default_edited']) {
        Garbage.updateOne(
          { user: currentUser.id },
          {
            $pull: { edited_pdf: { $in: [pdf.default_pdf] } },
          }
        ).catch((err) => {
          console.log('default pdf remove err', err.message);
        });
      } else {
        const url = pdf.url;
        if (url.indexOf('teamgrow.s3') > 0) {
          const url = pdf.url;
          s3.deleteObject(
            {
              Bucket: api.AWS.AWS_S3_BUCKET_NAME,
              Key: url.slice(44),
            },
            function (err, data) {
              console.log('err', err);
            }
          );

          pdf['del'] = true;
          pdf.save();

          res.send({
            status: true,
          });
        } else {
          res.status(404).send({
            status: false,
            error: 'invalid permission',
          });
        }
      }
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
        as: 'pdf_detail',
      },
    },
    {
      $match: { pdf: req.params.id, user: currentUser.id },
    },
  ]);
  for (let i = 0; i < _activity_list.length; i++) {
    const _pdf_tracker = PDFTracker.find({
      contact: _activity_list[i].contact,
      pdf: req.params.id,
      user: currentUser.id,
    });
    _activity_list[i].pdf_tracker = _pdf_tracker;
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
  const { content, subject, pdfs, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = AssistantHelper.activityLog(detail_content);
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: pdf_subject,
        html:
          '<html><head><title>PDF Invitation</title></head><body><p style="white-space:pre-wrap;max-width:800px;margin-top:0px;">' +
          pdf_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          emailHelper.generateUnsubscribeLink(activity.id) +
          '</body></html>',
        text: pdf_content,
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              email_count += 1;
              Contact.updateOne(
                {
                  _id: contacts[i],
                },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
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
              resolve();
            }
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            console.log('email sending err', msg.to);
            console.error(err);
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

const bulkText = async (req, res) => {
  const { currentUser } = req;
  const { content, pdfs, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
        (err) => {
          console.log('err', err);
        }
      );
      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_content = content;
      const activities = [];
      let activity;

      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_content = pdf_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: 'sent pdf using sms',
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (j < pdfs.length - 1) {
          pdf_titles = pdf_titles + pdf.title + ', ';
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_titles += pdf.title;
          pdf_descriptions += pdf.description;
        }
        const pdf_object = `\n${pdf.title}:\n\n${pdf_link}\n`;
        pdf_objects += pdf_object;
        activities.push(activity);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '\n' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      let fromNumber = currentUser['proxy_number'];

      if (!fromNumber) {
        fromNumber = await textHelper.getTwilioNumber(currentUser.id);
      }

      const promise = new Promise((resolve, reject) => {
        const e164Phone = phone(_contact.cell_phone)[0];
        console.log('e164Phone', e164Phone);
        if (!e164Phone) {
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err);
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
          .create({ from: fromNumber, body: pdf_content, to: e164Phone })
          .then(() => {
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              pdf_content
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
  const { content, pdfs, contacts } = req.body;

  const _contact = await Contact.findOne({ _id: contacts[0] }).catch((err) => {
    console.log('err', err);
  });
  let pdf_titles = '';
  let pdf_descriptions = '';
  let pdf_objects = '';
  let pdf_content = content;
  let activity;

  for (let j = 0; j < pdfs.length; j++) {
    const pdf = pdfs[j];

    if (typeof pdf_content === 'undefined') {
      pdf_content = '';
    }

    pdf_content = pdf_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const _activity = new Activity({
      content: 'sent pdf using sms',
      contacts: contacts[0],
      user: currentUser.id,
      type: 'pdfs',
      pdfs: pdf._id,
      created_at: new Date(),
      updated_at: new Date(),
      description: pdf_content,
    });

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

    if (j < pdfs.length - 1) {
      pdf_titles = pdf_titles + pdf.title + ', ';
      pdf_descriptions += `${pdf.description}, `;
    } else {
      pdf_titles += pdf.title;
      pdf_descriptions += pdf.description;
    }
    const pdf_object = `\n${pdf.title}:\n${pdf_link}\n`;
    pdf_objects += pdf_object;
  }

  if (pdf_content.search(/{pdf_object}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
  } else {
    pdf_content += pdf_objects;
  }

  if (pdf_content.search(/{pdf_title}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
  }

  if (pdf_content.search(/{pdf_description}/gi) !== -1) {
    pdf_content = pdf_content.replace(/{pdf_description}/gi, pdf_descriptions);
  }

  return res.send({
    status: true,
    data: pdf_content,
  });
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdfs, contacts } = req.body;
  const promise_array = [];
  const error = [];

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = AssistantHelper.activityLog(detail_content);
    }

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
      let promise;

      await new Promise((resolve, reject) => {
        token.refresh((error, result) => {
          if (error) {
            reject(error.message);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('outlook token grant error', error);
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: pdf_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
              pdf_content +
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
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            email_count += 1;
            resolve();
          })
          .catch((err) => {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err);
            });
            console.log('err', err);
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

const bulkGmail = async (req, res) => {
  const { currentUser } = req;
  const { content, subject, pdfs, contacts } = req.body;
  const promise_array = [];
  const error = [];

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  await oauth2Client.getAccessToken().catch((err) => {
    console.log('get access err', err);
    return res.status(406).send({
      status: false,
      error: 'not connected',
    });
  });

  if (contacts) {
    if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
      });
    }

    let email_count = currentUser['email_info']['count'] || 0;
    let no_connected = false;
    const max_email_count =
      currentUser['email_info']['max_count'] ||
      system_settings.EMAIL_DAILY_LIMIT.BASIC;

    let detail_content = 'sent pdf using email';
    if (req.guest_loggin) {
      detail_content = AssistantHelper.activityLog(detail_content);
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

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      const activities = [];
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
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
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`
        const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><br/><a href="${pdf_link}"><img src="${pdf.preview}?resize=true"/></a><br/></p>`;
        pdf_objects += pdf_object;
        activities.push(activity.id);
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const email_content =
        '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
        pdf_content +
        '<br/>Thank you,<br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
      // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, pdf_subject, email_content );

      promise = new Promise((resolve, reject) => {
        // gmail.users.messages.send({
        //   'userId': currentUser.email,
        //   'resource': {
        //     raw: rawContent
        //   }
        // }, (err, response) => {
        //   if(err) {
        //     Activity.deleteOne({_id: activity.id}).catch(err=>{
        //       console.log('err', err)
        //     })
        //     console.log('err', err)
        //     error.push({
        //       contact: {
        //         first_name: _contact.first_name,
        //         email: _contact.email
        //       },
        //       err: err
        //     })
        //     resolve();
        //   }
        //   else {
        //     Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
        //       console.log('err', err)
        //     })
        //     resolve();
        //   }
        // })
        try {
          const body = createBody({
            headers: {
              To: _contact.email,
              From: `${currentUser.user_name} <${currentUser.connected_email}>`,
              Subject: pdf_subject,
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
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('err', err);
              });
              email_count += 1;
              resolve();
            })
            .catch((err) => {
              console.log('gmail pdf send err', err);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err);
              });
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  email: _contact.email,
                },
                err,
              });
              resolve();
            });
        } catch (err) {
          console.log('err', err);
          Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
            console.log('err', err);
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
        }
      });
      promise_array.push(promise);
    }

    Promise.all(promise_array)
      .then(() => {
        if (no_connected) {
          return res.status(406).send({
            status: false,
            error: 'no connected',
          });
        }
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

module.exports = {
  play,
  play1,
  create,
  updateDetail,
  updateDefault,
  get,
  getAll,
  getPreview,
  sendPDF,
  sendText,
  bulkEmail,
  bulkText,
  createSmsContent,
  remove,
  getHistory,
  bulkOutlook,
  bulkGmail,
};
