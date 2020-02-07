const TimeLine = require('../models/time_line.js')
const Automation = require('../models/automation')
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

module.exports = {
  create,
}