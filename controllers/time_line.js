const TimeLine = require('../models/time_line')
const Automation = require('../models/automation')
const Contact = require('../models/contact')
const Note = require('../models/note')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Reminder = require('../models/reminder')
const EmailHelper = require('../helpers/email')
const TextHelper = require('../helpers/text')
const moment = require('moment')

const create = async (req, res) => {
  const { currentUser } = req
  const { contacts, automation_id } = req.body
  const _automation = await Automation.findOne({ _id: automation_id }).catch(err => {
    console.log('err', err)
    return res.status(400).json({
      status: false,
      err: err.message || 'Automation found err'
    })
  })

  if (_automation) {
    const automations = _automation['automations']
    for (let i = 0; i < automations.length; i++) {
      const automation = automations[i]
      for (let j = 0; j < contacts.length; j++) {
        let time_line
        if (automation['status'] == 'active') {
          const period = automation['period']
          let now = moment()
          let tens = parseInt(now.minutes() / 10)
          due_date = now.add(period, 'hours').minutes(tens*10);
          due_date.set({ minute: tens*10, second: 0, millisecond: 0 })
          
          _time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[j],
            automation: automation_id,
            due_date: due_date,
            created_at: new Date(),
            updated_at: new Date()
          })
          _time_line.save().then(timeline => {
            if (timeline['period'] == 0) {
              try {
                runTimeline(timeline.id)
                const data = {
                  contact: contacts[j],
                  ref: timeline.ref,
                }
                activeNext(data)
              } catch (err) {
                console.log('err', err)
              }
            }
          }).catch(err => {
            console.log('err', err)
          })
        } else {
          time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[j],
            automation: automation_id,
            created_at: new Date(),
            updated_at: new Date()
          })
          time_line.save().catch(err => {
            console.log('err', err)
          })
        }
      }
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

const activeNext = async (data) => {
  const { contact, ref } = data

  const timelines = await TimeLine.find({
    contact: contact,
    status: 'pending',
    parent_ref: ref,
  })
  if (timelines) {
    for (let i = 0; i < timelines.length; i++) {
      const timeline = timelines[i]
      if (timeline.condition && timeline.condition.answer == true) {
        continue;
      }
      const period = timeline['period']
      let now = moment()
      let tens = parseInt(now.minutes() / 10)
      let due_date = now.add(period, 'hours');
      due_date.set({ minute: tens*10, second: 0, millisecond: 0 })
      timeline['status'] = 'active'
      timeline['due_date'] = due_date
      timeline.save().catch(err => {
        console.log('err', err)
      })
    }
  }
}

const runTimeline = async (id) => {
  const timelines = await TimeLine.find({ _id: id }).catch(err => {
    console.log('err', err)
  })
  for (let i = 0; i < timelines.length; i++) {
    const timeline = timelines[i]
    const action = timeline['action']
    let data
    if (!action) {
      continue;
    }
    switch (action.type) {
      case 'follow_up':
        let follow_due_date
        if (action.due_date) {
          follow_due_date = action.due_date
        } else {
          let now = moment()
          let tens = parseInt(now.minutes() / 10)
          follow_due_date = now.add(action.due_duration, 'hours').minutes(tens*10);
          follow_due_date.set({minute: tens*10,second:0,millisecond:0})
        }
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
            const mins = new Date(_followup.due_date).getMinutes() - 30
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

            reminder.save().catch(err => {
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
              timeline['status'] = 'completed'
              timeline.save().catch(err => {
                console.log('err', err)
              })
              Contact.findByIdAndUpdate(_followup.contact, { $set: { last_activity: _activity.id } }).catch(err => {
                console.log('err', err)
              })
            }).catch(err => {
              console.log('follow error', err)
            });
          })
          .catch(err => {
            timeline['status'] = 'error'
            timeline.save().catch(err => {
              console.log('err', err)
            })
            console.log('follow error', err)
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
              Contact.findByIdAndUpdate(_note.contact, { $set: { last_activity: _activity.id } }).catch(err => {
                console.log('err', err)
              })
              timeline['status'] = 'completed'
              timeline.save().catch(err => {
                console.log('err', err)
              })
            })
          })
          .catch(err => {
            console.log('err', err)
            timeline['status'] = 'error'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          });
        break;
      case 'email':
        data = {
          user: timeline.user,
          video: action.video,
          subject: action.subject,
          content: action.content,
          contacts: [timeline.contact]
        }
        EmailHelper.bulkEmail(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
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
        TextHelper.bulkVideo(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
      case 'send_email_video':
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          videos: [action.video],
          contacts: [timeline.contact]
        }
        EmailHelper.bulkVideo(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
      case 'send_text_pdf':
        data = {
          user: timeline.user,
          content: action.content,
          pdfs: [action.pdf],
          contacts: [timeline.contact]
        }
        TextHelper.bulkPdf(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
      case 'send_email_pdf':
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          pdfs: [action.pdf],
          contacts: [timeline.contact]
        }
        EmailHelper.bulkPdf(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
      case 'send_text_image':
        data = {
          user: timeline.user,
          content: action.content,
          images: [action.image],
          contacts: [timeline.contact]
        }
        TextHelper.bulkImage(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
      case 'send_email_image':
        data = {
          user: timeline.user,
          content: action.content,
          images: [action.image],
          subject: action.subject,
          contacts: [timeline.contact]
        }
        EmailHelper.bulkImage(data).then(res => {
          console.log('res', res)
          if (res[0].status == false) {
            timeline['status'] = 'error'
            console.log('err', res[0].err)
            timeline.save().catch(err => {
              console.log('err', err)
            })
          } else {
            timeline['status'] = 'completed'
            timeline.save().catch(err => {
              console.log('err', err)
            })
          }
        }).catch(err => {
          console.log('err', err)
        })
        break;
    }
  }
}

const cancel = (req, res) => {
  let contact = req.params.contact;

  TimeLine.deleteMany({ contact: contact }).then(data => {
    return res.send({
      status: true
    })
  }, err => {
    return res.status(500).send({
      status: false,
      error: err
    })
  })
}

const recreate = async (req, res) => {
  const { currentUser } = req;
  const { contact, automation_id } = req.body;
  await TimeLine.deleteMany({ contact: contact }).catch(err => {
    return res.status(500).send({
      status: false,
      error: err
    })
  })

  const _automation = await Automation.findOne({ _id: automation_id }).catch(err => {
    console.log('err', err)
    res.status(400).json({
      status: false,
      err: err.message || 'Automation found err'
    })
  })

  if (_automation) {
    const automations = _automation['automations']
    for (let i = 0; i < automations.length; i++) {
      const automation = automations[i]
      let time_line
      if (automation['status'] == 'active') {
        const period = automation['period']
        let now = moment()
        let due_date = now.add(period, 'hours');
        due_date.set({ second: 0, millisecond: 0 })
        _time_line = new TimeLine({
          ...automation,
          ref: automation.id,
          parent_ref: automation.parent,
          user: currentUser.id,
          contact: contact,
          automation: automation_id,
          due_date: due_date,
          created_at: new Date(),
          updated_at: new Date()
        })
        _time_line.save().then(timeline => {
          if (timeline['period'] == 0) {
            try {
              runTimeline(timeline.id)
              const data = {
                contact: contact,
                ref: timeline.ref,
              }
              activeNext(data)
            } catch (err) {
              console.log('err', err)
            }
          }
        }).catch(err => {
          console.log('err', err)
        })
      } else {
        time_line = new TimeLine({
          ...automation,
          ref: automation.id,
          parent_ref: automation.parent,
          user: currentUser.id,
          contact: contact,
          automation: automation_id,
          created_at: new Date(),
          updated_at: new Date()
        })
        time_line.save().catch(err => {
          console.log('err', err)
        })
      }
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

module.exports = {
  create,
  recreate,
  activeNext,
  runTimeline,
  cancel
}