const mongoose = require('mongoose');
const User = require('../models/user');
const Contact = require('../models/contact');
const Tag = require('../models/tag')
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from
const migrate = async() => {
  const users = await User.find({}).catch(err=>{
    console.log('err', err)
  })
  for(let i=0; users.length; i++){
  
    const contacts = await Contact.find({user: users[i]._id}).populate('tag').catch(err=>{
      console.log('err', err)
    })
    
    if(contacts){
      for(let j=0; j<contacts.length; j++){
        const contact = contacts[j]
        if(!contact['tags']){
          let tags = []
          for(let k=0; k<contact['tag'].length; k++){
            const tag = contact['tag'][k]
            console.log('tag', tag.content)
             tags.push(tag.content)
          }
          contact['tags'] = tags
          contact.save().catch(err=>{
            console.log('err', err)
          })      
        }
      }
    }
  }
}
migrate();