const TimeLine = require('../models/time_line')
const Automation = require('../models/automation')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Reminder = require('../models/reminder')
const EmailHelper = require('../helpers/email')
const TextHelper = require('../helpers/text')
const moment = require('moment')

const create = async(req, res) => {
  const { currentUser } = req
  const { contact, automation_id } = req.body
  
  const _automation = await Automation.findOne({_id: automation_id}).catch(err=>{
    console.log('err', err)
    res.status(400).json({
      status: false,
      err: err.message || 'Automation found err'
    })
  })
  
  if(_automation){
    const automations = _automation['automations']
    for(let i=0; i<automations.length; i++){
      const automation = automations[i]
      let time_line
      if(automation['status'] === 'active'){
        const period = automation['period']
        let now = moment()
        let due_date = now.add(period, 'hours');
        due_date.set({minute:0,second:0,millisecond:0})
        time_line = new TimeLine({
          ...automation,
          user: currentUser.id,
          contact: contact,
          automation: automation_id,
          due_date: due_date,
          created_at: new Date(),
          updated_at: new Date()
        })
      } else {
        time_line = new TimeLine({
          ...automation,
          user: currentUser.id,
          contact: contact,
          automation: automation_id,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
      time_line.save().catch(err=>{
        console.log('err', err)
      })
    }
    return res.send({
      status: true
    })
  } else {
    res.status(400).json({
      status: false,
      err: 'Automation not found'
    })
  }
}

const activeNext = data => {
  const {contact, ref, due_date} = data
  return TimeLine.find({
    contact: contact,
    status: 'pending',
    parent_ref: ref,
  }).updateMany ({
    status: 'active',
    due_date: due_date
  })
}

const runTimeline = async(id) => {
  const timelines = await TimeLine.find({_id: id}).catch(err=>{ 
    console.log('err', err)
  })
  
  for(let i=0; i<timelines.length; i++){
    const timeline = timelines[i]
    const action = timeline['action']
    let data 
    switch(action.type) {
      case 'follow_up':
        const follow_due_date = action.due_date
        const followUp = new FollowUp({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
          type: 'follow_up',
          due_date: follow_due_date,
          updated_at: new Date(),
          created_at: new Date(),
        })
        
        followUp.save()
        .then(_followup => {
          const mins = new Date(_followup.due_date).getMinutes()-30 
          let reminder_due_date = new Date(_followup.due_date).setMinutes(mins)
          const reminder = new Reminder({
            contact: timeline.contact,
            due_date: reminder_due_date,
            type: 'follow_up',
            user: timeline.user,
            follow_up: _followup.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
          
          reminder.save().catch(err=>{
            console.log('error', err)
          })
      
          const activity = new Activity({
            content: 'added follow up',
            contacts: _followup.contact,
            user: timeline.user,
            type: 'follow_ups',
            follow_ups: _followup.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
      
          activity.save().then(_activity => {
            Contact.findByIdAndUpdate( _followup.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
              console.log('err', err)
            })
          }).catch(e => {
            console.log('follow error', e)
          });
        })
        .catch(e => {
          console.log('follow error', e)
        });
        break;
      case 'note':
        const note = new Note({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
          updated_at: new Date(),
          created_at: new Date(),
        })
        
        note.save()
        .then(_note => {
          const activity = new Activity({
            content: 'added note',
            contacts: _note.contact,
            user: timeline.user,
            type: 'notes',
            notes: _note.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
      
          activity.save().then(_activity => {
            Contact.findByIdAndUpdate( _note.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
              console.log('err', err)
            })
          })    
        })
        .catch(error => {
          console.log('err', error)
        });
        // code block
        break;
      case 'email':
        data = {
          user: timeline.user,
          subject: action.subject,
          content: action.content,
          contacts: [timeline.contact]
        }
        EmailHelper.bulkEmail(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
        break;
      case 'send_text_video':
        data = {
          user: timeline.user,
          videos: [action.video],
          content: action.content,
          contacts: [timeline.contact]
        }
        TextHelper.bulkVideo(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
      case 'send_email_video':
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          videos: [action.video],
          contacts: [timeline.contact]
        }
        EmailHelper.bulkVideo(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
      case 'send_text_pdf':
        data = {
          user: timeline.user,
          content: action.content,
          pdf: action.pdf,
          contacts: [timeline.contact]
        }
        TextHelper.bulkPdf(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
      case 'send_email_pdf': 
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          pdf: action.pdf,
          contacts: [timeline.contact]
        }
        EmailHelper.bulkPdf(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
      case 'send_text_image': 
        data = {
          user: timeline.user,
          content: action.content,
          image:  action.image,
          contacts: [timeline.contact]
        }
        TextHelper.bulkImage(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
      case 'send_email_image':
        data = {
          user: timeline.user,
          content: action.content,
          image: action.image,
          subject: action.subject,
          contacts: [timeline.contact]
        }
        EmailHelper.bulkImage(data).then(res=>{
          console.log('res', res)
        }).catch(err=>{
          console.log('err', err)
        })
    }
  }
}

module.exports = {
  create,
  activeNext,
  runTimeline
}