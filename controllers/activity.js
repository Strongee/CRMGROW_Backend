const { validationResult } = require('express-validator/check')
const Activity = require('../models/activity');
const Contact = require('../models/contact')
const UserLog = require('../models/user_log')

const get = async(req, res) => {
  const { currentUser } = req
  const count = await Activity.find({user: currentUser.id}).countDocuments()
  let activity
  if(typeof req.params.id == 'undefined'){
    activity = await Activity.find({user :currentUser.id}).sort({'updated_at': -1}).populate('contacts').limit(20);
  }else{
    const id = parseInt(req.params.id)
    activity = await Activity.find({user :currentUser.id}).sort({'updated_at': -1}).populate('contacts').skip(id).limit(20);
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

const getByLastActivity = async(req, res) => {
  const { currentUser } = req  
  let contacts
  if(typeof req.params.id == 'undefined'){
    contacts= await Contact.find({user :currentUser.id}).sort({first_name: 1}).limit(15)
  }else{
    const id = parseInt(req.params.id)
    contacts = await Contact.find({user :currentUser.id}).sort({first_name: 1}).skip(id).limit(15)
  }
  
  let activity = []
  for (let i =0; i < contacts.length; i ++){
    const _activity = await Activity.find({user :currentUser.id, contacts: contacts[i].id}).sort({updated_at : -1 }).limit(1);
    myJSON = JSON.stringify(_activity[0])
    if(myJSON){
      const __activity = JSON.parse(myJSON)
      delete __activity.contacts
      __activity.contacts = contacts[i]
      activity.push(__activity)
    }    
  }
  
  if (!activity) {
    return res.status(400).json({
      status: false,
      error: 'Activity doesn`t exist'
    })
  }

  const count = await Contact.find({user :currentUser.id}).countDocuments()

  const user_log = new UserLog({
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date()
  })

  user_log.save().catch(err=>{
    console.log('err', err)
  })
  
  return res.send({
    status: true,
    data: {
      activity,
      count: count
    }
  })
}

const getAllByLastActivity = async(req, res) => {
  const { currentUser } = req
  const contacts = await Contact.find({user :currentUser.id}).sort({first_name: 1})

  let data = []
  for (let i =0; i < contacts.length; i ++){
    const _activity = await Activity.find({user :currentUser.id, contacts: contacts[i].id}).sort({updated_at : -1 }).limit(1);
    myJSON = JSON.stringify(_activity[0])
    const __activity = JSON.parse(myJSON)
    delete __activity.contacts
    __activity.contacts = contacts[i]
    data.push(__activity)
  }
  
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Activity doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

module.exports = {
    get,
    create,
    getByLastActivity,
    getAllByLastActivity,
}