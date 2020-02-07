const { validationResult } = require('express-validator/check')
const mongoose = require('mongoose')
const Automation = require('../models/automation')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const Note = require('../models/note')
const User = require('../models/user')
const EmailTracker = require('../models/email_tracker')
const sgMail = require('@sendgrid/mail')
const urls = require('../constants/urls')
const fs = require('fs')
const csv = require('csv-parser')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')
const webpush = require('web-push');
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const moment = require('moment')

const get = (req, res) => {
    const id = req.params.id;

    Automation.findOne({_id: id}).then(data => {
        res.send({
            status: false,
            data
        })
    }).catch(err => {
        res.status(500).send({
            status: false,
            error: err.message || 'Automation reading is failed.'
        })
    })
}

const getPage = async (req, res) => {
    const {currentUser} = req;
    const page = req.params.page;

    const automations = await Automation.find({
        $or: [
            {user: currentUser.id}
        ]
    }).skip((page-1) * 10).limit(10);

    const total = await Automation.countDocuments({
        user: currentUser.id
    })

    return res.json({
        status: true,
        data: automations,
        total: total
    })
}

const create = (req, res) => {
    const { currentUser } = req;
    const automation = new Automation({
        ...req.body,
        user: currentUser.id,
        created_at: new Date(),
        updated_at: new Date()
    })

    automation.save().then(_automation => {
        res.send({
            status: true,
            data: _automation
        })
    }).catch(err => {
        res.status(500).send({
            status: false,
            error: err.message || 'Automation creating is failed.'
        })
    })
}

const update = (req, res) => {
    const id = req.params.id;
    const data = req.body;
    Automation.find({_id: id}).update({$set: data}).then(() => {
        res.send({
            status: true
        })
    }).catch(err => {
        res.status(400).send({
            status: false,
            error: err.message || 'Automation Updating is failed.'
        })
    })
}

const remove = async(req, res) => {
    const id = req.params.id;

    await Automation.deleteOne({_id: req.params.id}).catch(err => {
        req.status(400).send({
            status: false
        })
    })

    res.send({
        status: false
    })
}

const search = async(req, res) => {
    const condition = req.body;
    const { currentUser } = req;

    Automation.find({user: currentUser.id, title: { '$regex': '.*' + condition.search + '.*', '$options': 'i' }})
        .then((data) => {
            res.send({
                status: false,
                data
            })
        })  
        .catch(err => {
            req.status(400).send({
                status: false
            })
        })    
}

module.exports = {
  get,
  getPage,
  create,
  update,
  remove,
  search
}