const { validationResult } = require('express-validator/check')
const Activity = require('../models/activity');
const UserLog = require('../models/user_log')
const User = require('../models/user')

const get = async(req, res) => {
  const { currentUser } = req
  const count = await Activity.countDocuments({user: currentUser.id})
  let activity
  if(typeof req.params.id == 'undefined'){
    activity = await Activity.find({user :currentUser.id}).sort({'updated_at': -1}).populate('contacts').limit(20);
  }else{
    const id = parseInt(req.params.id)
    activity = await Activity.find({user :currentUser.id}).sort({'updated_at': -1}).populate('contacts').skip(id).limit(20);
  }

  if(!currentUser['admin_loggin']){
    currentUser['last_logged'] = new Date()
    currentUser.save().catch(err=>{
      console.log('err', err)
    })
    
    const user_log = new UserLog({
      user: currentUser.id,
      created_at: new Date(),
      updated_at: new Date()
    })
  
    user_log.save().catch(err => {
      console.log('err', err)
    })
  }

  return res.send({
    status: true,
    data: {
      activity,
      count: count
    }
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

  const activity = new Activity({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })

  activity.save()
  .then(_res => {
      const data = _res
      res.send({
        status: true,
        data
      })
  })
  .catch(e => {
    return res.status(500).send({
      status: false,
      error: e 
    })
  });
}

module.exports = {
    get,
    create,
}