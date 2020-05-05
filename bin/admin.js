const mongoose = require('mongoose')
const { ENV_PATH } = require('../config/path')
require('dotenv').config({ path: ENV_PATH })
const { DB_PORT } = require('../config/database')

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
const config = require('../config/config')
const Contact = require('../models/contact')
const User = require('../models/user')
const Activity = require('../models/activity')

const addContacts = async() => {
  
  const admin = await User.findOne({email: 'support@crmgrow.com'}).catch(err => {
    console.log('err', err)
  })
  if(admin){
    const users = await User.find({del: false}).catch(err => {
      console.log('err', err)
    })
    for(let i=0; i<users.length; i++){
      const user = users[i]
      let contact
      let label
      const old_user = await Contact.findOne({email: user.email, user: admin.id}).catch(err=>{
        console.log('err', err)
      })
      if(!old_user){
        let week_ago = new Date()
        let month_ago = new Date()
        let two_month_ago = new Date()
        week_ago.setDate(week_ago.getDate()-7)
        month_ago.setMonth(month_ago.getMonth() - 1);
        two_month_ago.setMonth(two_month_ago.getMonth() - 2);
        if(user.last_logged) {
          let last_logged = new Date(user.last_logged)
          let created = new Date(user.created_at)
          
          if(created.getTime()>week_ago.getTime()) {
            label = 'New'
          }else if(last_logged.getTime()>week_ago.getTime()){
            label = 'Hot'
          } else if(last_logged.getTime()>month_ago.getTime()){
            label = 'Warm'
          } else {
            label = 'Cold'
          }
        } else {
          label = 'Cold'
        }
        if(user.payment) {
          if(user.subscription && user.subscription.is_suspended) {
            contact = new Contact({
              first_name: user.user_name.split(" ")[0],
              last_name: user.user_name.split(" ")[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['suspended', user.company],
              label: label,
              created_at: user.created_at,
              user: admin.id
            })
          } else if(user.subscription && user.subscription.is_failed) {
            contact = new Contact({
              first_name: user.user_name.split(" ")[0],
              last_name: user.user_name.split(" ")[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['failed', user.company],
              label: label,
              created_at: user.created_at,
              user: admin.id
            })
          } else {
            contact = new Contact({
              first_name: user.user_name.split(" ")[0],
              last_name: user.user_name.split(" ")[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['active',  user.company],
              label: label,
              created_at: user.created_at,
              user: admin.id
            })
          }
        }else if(user.last_logged && new Date(user.last_logged.getTime())>two_month_ago.getTime()){
          contact = new Contact({
            first_name: user.user_name.split(" ")[0],
            last_name: user.user_name.split(" ")[1],
            email: user.email,
            cell_phone: user.cell_phone,
            created_at: user.created_at,
            tags: ['free', user.company],
            label: label,
            user: admin.id
          })
          
        }
        if(contact){
          contact.save().then(_contact=>{
            const activity = new Activity({
              content: 'added contact',
              contacts: _contact.id,
              user: admin.id,
              type: 'contacts',
              created_at: new Date(),
              updated_at: new Date(),
            })
        
            activity.save().then(_activity => {
              _contact['last_activity'] = _activity.id
              _contact.save().then(__contact=>{
                console.log('email', __contact.email)
              }).catch(err => {
                console.log('err', err)
              })
            })
          }).catch(err=>{
            console.log('err', err)
          })
        }
        

      }
    }
  }
}

const updateContacts = async() => {
  const admin = await User.findOne({email: 'support@crmgrow.com'}).catch(err => {
    console.log('admin account found', err.message)
  })
  
  const adminContacts = await Contact.find({user: admin.id}).catch(err=>{
    console.log('admin contact found err', err.message)
  })
  
}

const sourceUpdate = async() => {
  const admin = await User.findOne({email: 'support@crmgrow.com'}).catch(err => {
    console.log('admin account found', err.message)
  })
  
  const adminContacts = await Contact.find({user: admin.id}).catch(err=>{
    console.log('admin contact found err', err.message)
  })
  for(let i=0; i<adminContacts.length; i++){
    const adminContact = adminContacts[i]
    const user = await User.findOne({email: adminContact.email}).catch(err=>{
      console.log('admin user maching contact err ', err.message)
    })
    console.log('email', user.email)
    console.log('user.id', user.id)
    Contact.updateMany({_id: adminContact.id}, { $set: {source: user.id} }).catch(err=>{
      console.log('contact update error', err.message)
    })
  }
}
// sourceUpdate()
// addContacts()
sourceUpdate()