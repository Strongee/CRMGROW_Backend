const { validationResult } = require('express-validator/check')
const User = require('../models/user')
const Contact = require('../models/contact');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const Activity = require('../models/activity');
const sgMail = require('@sendgrid/mail')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')
const config = require('../config/config')

const get = async(req, res) => {
  const { currentUser } = req
  const { contact } = req.params
  const data = await VideoTracker.find({user :currentUser.id, contact: contact});

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Video log doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
  const query = {...req.query}
  console.log('req.query', query)
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  const video_tracker = new VideoTracker({
    ...req.query,
    updated_at: new Date(),
    created_at: new Date(),
  })

  const currentUser = await User.findOne({_id: req.query['user']})
  const contact = await Contact.findOne({_id: req.query['contact']})
  const video = await Video.findOne({_id: req.query['video']})
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const watched_duration_min = Math.floor(req.query['duration']/60000);
  const watched_duration_sec = (req.query['duration']/60000 - watched_duration_min).toString().substring(2,4);
  const total_duration_min = Math.floor(video.duration/60000);
  const total_duration_sec = (video.duration/60000 - Math.floor(video.duration/60000)).toString().substring(2,4);


  const msg = {
    to: currentUser.email,
    from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
    subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
    templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
    dynamic_template_data: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone_number: contact.cell_phone,
      email: contact.email,
      activity: contact.first_name + ' watched video - <b>' + video.title + '</b>',
      duration: 'Watched <b>' + watched_duration_min + ':' + watched_duration_sec + ' of ' + total_duration_min + ':' + total_duration_sec + ' </b>at ' + req.query['time_start'],
      detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'>View Contact Activity</a>"
    },
  };

  await sgMail.send(msg)

  video_tracker.save()
  .then(_video_tracker => {

    const activity = new Activity({
      content: contact.first_name + ' watched video',
      contacts: _video_tracker.contact,
      user: currentUser.id,
      type: 'video_trackers',
      video_trackers: _video_tracker.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      myJSON = JSON.stringify(_video_tracker)
      const data = JSON.parse(myJSON);
      data.activity = _activity
      res.send({
        status: true,
        data
      })
    })
  }).catch(e => {
    return res.status(500).send({
      status: false,
      error:  e
    })
  });
}

module.exports = {
    get,
    create,
}