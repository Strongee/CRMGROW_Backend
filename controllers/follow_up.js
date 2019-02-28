const { validationResult } = require('express-validator/check')
const moment = require('moment');
const FollowUp = require('../models/follow_up');
const Contact = require('../models/contact')

const get = async(req, res) => {
  const { currentUser } = req
  const _follow_up = await FollowUp.find({user :currentUser.id}).sort({created_at: -1});
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
  console.log('req.body',req.body)
  followUp.save()
  .then(_res => {
      const data = _res
      res.send({
        status: true,
        data
      })
  })
  .catch(e => {
      let errors
    if (e.errors) {
      errors = e.errors.map(err => {      
        delete err.instance
        return err
      })
    }
    return res.status(500).send({
      status: false,
      error: errors || e
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
    'next_month'
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
      const data = await FollowUp.find({user :currentUser.id, created_at: {$lt: current_time}});

      if (!overdue) {
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
      const current_time = moment().utcOffset(time_zone);
      const start = current_time.startOf('day');      // set to 12:00 am today
      const end = current_time.endOf('day');          // set to 23:59 pm today
      const data = await FollowUp.find({user :currentUser.id, created_at: {$gte: start, $lt: end}})

      if (!today) {
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
      const current_time = moment().utcOffset(time_zone);
      const today_start = current_time.startOf('day')     // set to 12:00 am today
      const today_end = current_time.endOf('day');        // set to 23:59 pm today
      const tomorrow_start =  today_start.add(1, 'day');
      const tomorrow_end = today_end.add(1, 'day');

      data = await FollowUp.find({user :currentUser.id, created_at: {$gte: tomorrow_start, $lt: tomorrow_end}})

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
      const next_week_start = moment().utcOffset(time_zone).add(1, 'day')
      const next_week_end = moment().utcOffset(time_zone).add('days', 7).endOf('day')
      const data = await FollowUp.find({user :currentUser.id, created_at: {$gte: next_week_start, $lt: next_week_end}})

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
      const data = await FollowUp.find({user :currentUser.id, created_at: {$gte: start_month, $lt: end_month}})
      
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
    default:

  }
}
module.exports = {
    get,
    create,
    getByDate
}