const { validationResult } = require('express-validator/check')
const moment = require('moment')
const FollowUp = require('../models/follow_up')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const Reminder = require('../models/reminder')

const get = async(req, res) => {
  const { currentUser } = req
  const _follow_up = await FollowUp.find({user :currentUser.id, status: 0}).sort({due_date: -1});
  let data = [];

  for(let i = 0; i < _follow_up.length; i ++){
    const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
    myJSON = JSON.stringify(_follow_up[i])
    const follow_up = JSON.parse(myJSON);
    delete follow_up.contact
    follow_up.contact = _contact
    data.push(follow_up)
  }

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'FollowUp doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
  const { currentUser } = req
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

 
  const followUp = new FollowUp({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  
  followUp.save()
  .then(_followup => {

    const mins = new Date(_followup.due_date).getMinutes()-30 
    let due_date = new Date(_followup.due_date).setMinutes(mins).split('.')[0]+"Z"
    console.log('due_date', due_date)
    const reminder = new Reminder({
      contact: _followup.contact,
      due_date: due_date,
      type: 'follow_up',
      user: currentUser.id,
      follow_up: _followup.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    reminder.save().catch(err=>{
      console.log('error', err)
    })

    const activity = new Activity({
      content: currentUser.user_name + ' added follow up',
      contacts: _followup.contact,
      user: currentUser.id,
      type: 'follow_ups',
      follow_ups: _followup.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      myJSON = JSON.stringify(_followup)
      const data = JSON.parse(myJSON);
      data.activity = _activity
      return res.send({
        status: true,
        data
      })
    }).catch(e => {
      console.log('follow error', e)
      return res.status().send({
        status: false,
        error: e
      })
    });
  })
  .catch(e => {
    console.log('follow error', e)
    return res.status().send({
      status: false,
      error: e
    })
  });
}

const getByDate = async(req, res) =>{
  const { currentUser } = req
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  // TODO: query condition should be defined in route
  // TODO: limit access to users
  const allowed_queries = [
    'overdue',
    'today',
    'tomorrow',
    'next_week',
    'next_month',
    'future'
  ]
  const query = {...req.query}
  const cquery = {...query}
  const due_date = query['due_date']
  const time_zone = currentUser.time_zone;

  // Check valid queries
  if(!allowed_queries.includes(due_date)) { // Other queries
    console.error('Query not allowed:', cquery)
    return res.status(400).send({
      status: false,
      error: {
        msg: 'Query not allowed',
        data: cquery
      }
    })
  }
  
  switch(due_date) {
    case 'overdue': {
      const current_time = moment().utcOffset(time_zone);
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$lt: current_time}});

      let data = [];
      
      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        console.log('contact', _contact)
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'OverDue doesn`t exist'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    case 'today': {
      console.log('moment', moment().utcOffset(8))
      const start =  moment().utcOffset(time_zone).startOf('day');      // set to 12:00 am today
      const end =  moment().utcOffset(time_zone).endOf('day');          // set to 23:59 pm today
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$gte: start, $lt: end}})

      let data = [];

      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }
    

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'FollowUp doesn`t exist on Today'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    case 'tomorrow': {
      const today_start = moment().utcOffset(time_zone).startOf('day');     // set to 12:00 am today
      const today_end = moment().endOf('day');        // set to 23:59 pm today
      const tomorrow_start =  today_start.add(1, 'day');
      const tomorrow_end = today_end.add(1, 'day');
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$gte: tomorrow_start, $lt: tomorrow_end}})

      let data = [];

      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        console.log('contact', _contact)
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    case 'next_week': {
      
      const next_week_start = moment().utcOffset(time_zone).add(2, 'day').startOf('day')
      const next_week_end = moment().utcOffset(time_zone).add('days', 7).endOf('day')
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$gte: next_week_start, $lt: next_week_end}})

      let data = [];
      
      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        console.log('contact', _contact)
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    case 'next_month': {
      const start_month = moment().utcOffset(time_zone).startOf('month').add(1, 'months')
      const end_month   =  moment().utcOffset(time_zone).add(1, 'months').endOf('month')
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$gte: start_month, $lt: end_month}})
      
      let data = [];

      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        console.log('contact', _contact)
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'FollowUp doesn`t exist on Tomorrow'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    case 'future': {
      const current_time = moment().utcOffset(time_zone);
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$gte: current_time}});

      let data = [];

      for(let i = 0; i < _follow_up.length; i ++){
        const _contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        console.log('contact', _contact)
        myJSON = JSON.stringify(_follow_up[i])
        const follow_up = JSON.parse(myJSON);
        delete follow_up.contact
        follow_up.contact = _contact
        data.push(follow_up)
      }

      if (!data) {
        return res.status(401).json({
          status: false,
          error: 'OverDue doesn`t exist'
        })
      }

      res.send({
        status: true,
        data
      })
      break;
    }
    default:

  }
}
const updateChecked  = async(req, res) =>{
  const { currentUser } = req
  const _follow_up = await FollowUp.findOne({_id: req.params.id})

  if (!_follow_up) {
    return res.status(401).json({
      status: false,
      error: 'FollowUp doesn`t exist'
    })
  }

  _follow_up.status = 1
  _follow_up.save()

  const activity = await Activity.findOne({type: 'follow_ups', follow_ups: _follow_up.id})
  activity['content'] = 'Complete Follow Up'
  activity['updated_at'] = new Date()

  const _contact = await Contact.findOne({_id: activity.contacts})

  activity.save().then(_activity => {
  
    myJSON = JSON.stringify(_activity)
    const data = JSON.parse(myJSON);
    data.contact = _contact
    res.send({
      status: true,
      data
    })
  }).catch(e => {
    return res.status(500).send({
      status: false,
      error: e
    })
  });
}


module.exports = {
    get,
    create,
    getByDate,
    updateChecked
}