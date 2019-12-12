const mongoose = require('mongoose');
const Contact = require('../models/contact');
const Tag = require('../models/tag')
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from

const migrate = async() => {
  const contacts = await Contact.find({}).populate('tag')
  for(let i=0; i<contacts.length; i++){
    const contact = contacts[i]
      let tags = []
      for(let j=0; j<contact['tag'].length; j++){
        const tag = contact['tag'][j]
        console.log('tag', tag.content)
         tags.push(tag.content)
      }
      contact['tags'] = tags
      contact.save()
    }
  }
migrate();