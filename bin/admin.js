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

const addContacts = async(req, res) => {
  
  const admin = await User.fineOne({email: 'support@crmgrow.com'}).catch('err', err)
  const users = await User.find({del: false}).catch('err', err)
  for(let i=0; i<users.length; i++){
    const user = users[i]
    let contact
    if(user.payment) {
      if(user.subscription && user.subscription.is_suspended) {
        contact = new Contact({
          first_name: user.user_name.split(" ")[0],
          last_name: user_name.split(" ")[1],
          email: user.email,
          cell_phone: user.cell_phone,
          tags: ['suspended'],
          created_at: user.created_at,
          user: admin.id
        })
      } else {
        contact = new Contact({
          first_name: user.user_name.split(" ")[0],
          last_name: user_name.split(" ")[1],
          email: user.email,
          cell_phone: user.cell_phone,
          tags: ['active'],
          created_at: user.created_at,
          user: admin.id
        })
      }
    } else {
      contact = new Contact({
        first_name: user.user_name.split(" ")[0],
        last_name: user_name.split(" ")[1],
        email: user.email,
        cell_phone: user.cell_phone,
        created_at: user.created_at,
        tags: ['free'],
        user: admin.id
      })
      
    }
    
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
addContacts()