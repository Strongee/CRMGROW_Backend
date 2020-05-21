const mongoose = require('mongoose');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

<<<<<<< HEAD
mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
const config = require('../config/config');
const Contact = require('../models/contact');
const User = require('../models/user');
const Activity = require('../models/activity');

const addContacts = async () => {
  const admin = await User.findOne({ email: 'support@crmgrow.com' }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  if (admin) {
    console.log('admin', admin);
    const users = await User.find({ del: false }).catch((err) => {
      console.log('err', err);
    });
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let contact;
      const old_user = await Contact.findOne({
        email: user.email,
        user: admin.id,
      }).catch((err) => {
        console.log('err', err);
      });
      if (!old_user) {
        if (user.payment) {
          if (user.subscription && user.subscription.is_suspended) {
=======
mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
const config = require('../config/config')
const Contact = require('../models/contact')
const User = require('../models/user')
const Activity = require('../models/activity')
const CronJob = require('cron').CronJob;

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
      const old_user = await Contact.findOne({source: user.id, user: admin.id}).catch(err=>{
        console.log('err', err)
      })
      if(!old_user){
        console.log('old_user', user.email)
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
>>>>>>> master
            contact = new Contact({
              first_name: user.user_name.split(' ')[0],
              last_name: user.user_name.split(' ')[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['suspended', user.company],
              label: label,
              created_at: user.created_at,
              user: admin.id,
              source: user.id
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
              user: admin.id,
<<<<<<< HEAD
            });
=======
              source: user.id
            })
>>>>>>> master
          } else {
            contact = new Contact({
              first_name: user.user_name.split(' ')[0],
              last_name: user.user_name.split(' ')[1],
              email: user.email,
              cell_phone: user.cell_phone,
              tags: ['active',  user.company],
              label: label,
              created_at: user.created_at,
              user: admin.id,
<<<<<<< HEAD
            });
=======
              source: user.id
            })
>>>>>>> master
          }
        }else if(user.last_logged && new Date(user.last_logged.getTime())>two_month_ago.getTime()){
          contact = new Contact({
            first_name: user.user_name.split(' ')[0],
            last_name: user.user_name.split(' ')[1],
            email: user.email,
            cell_phone: user.cell_phone,
            created_at: user.created_at,
<<<<<<< HEAD
            tags: ['free'],
            user: admin.id,
          });
        }

        contact
          .save()
          .then((_contact) => {
=======
            tags: ['free', user.company],
            label: label,
            user: admin.id,
            source: user.id
          })
          
        }
        if(contact){
          contact.save().then(_contact=>{
>>>>>>> master
            const activity = new Activity({
              content: 'added contact',
              contacts: _contact.id,
              user: admin.id,
              type: 'contacts',
              created_at: new Date(),
              updated_at: new Date(),
<<<<<<< HEAD
            });

            activity.save().then((_activity) => {
              _contact['last_activity'] = _activity.id;
              _contact
                .save()
                .then((__contact) => {
                  console.log('email', __contact.email);
                })
                .catch((err) => {
                  console.log('err', err);
                });
            });
          })
          .catch((err) => {
            console.log('err', err);
          });
=======
            })
        
            activity.save().then(_activity => {
              _contact['last_activity'] = _activity.id
              _contact.save().then(__contact=>{
                console.log('email', __contact.email)
              }).catch(err => {
                console.log('err', err.message)
              })
            })
          }).catch(err=>{
            console.log('err', err.message)
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
  for(let i=0; i<adminContacts.length; i++){
    const adminContact = adminContacts[i]
    const user = await User.findOne({_id: adminContact.source, del: false}).catch(err=>{
      console.log('admin user found err', err.message)
    })
    
    if(!user) {
      const _user = await User.findOne({_id: adminContact.source}).catch(err=>{
        console.log('admin user found err', err.message)
      })
      
      if(_user){
        Contact.updateMany({_id: adminContact.source}, 
          {$set: {
              tags: ['canceled',_user.company],
              label: 'Trash',
              updated_at: new Date()
            }
          }).catch(err=>{
            console.log('err', err.message)
          })
          continue;
      } else {
        Contact.updateMany({_id: adminContact.source}, 
          {$set: {
              tags: ['canceled'],
              label: 'Trash',
              updated_at: new Date()
            }
          }).catch(err=>{
            console.log('err', err.message)
          })
        continue;
      }
 
    }
    
    let update_data = {}
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
        update_data = {
          email: user.email,
          cell_phone: user.cell_phone,
          tags: ['suspended', user.company],
          label: label,
          updated_at: new Date()
        }
      } else if(user.subscription && user.subscription.is_failed) {
        update_data = {
          email: user.email,
          cell_phone: user.cell_phone,
          tags: ['failed', user.company],
          label: label,
          updated_at: new Date()
        }
      } else {
        update_data = {
          email: user.email,
          cell_phone: user.cell_phone,
          tags: ['active',  user.company],
          label: label,
          updated_at: new Date()
        }
>>>>>>> master
      }
    }else if(user.last_logged && new Date(user.last_logged.getTime())>two_month_ago.getTime()){
      update_data = {
        email: user.email,
        cell_phone: user.cell_phone,
        label: label,
        tags: ['free', user.company],
        updated_at: new Date()
      } 
    } else {
      update_data = {
        email: user.email,
        cell_phone: user.cell_phone,
        label: 'Trash',
        tags: ['free', user.company],
        updated_at: new Date()
      } 
    }
    
    Contact.updateMany({_id: adminContact.source}, {$set: update_data}).catch(err => {
      console.log('contact update error', err.message)
    })
  }
<<<<<<< HEAD
};
addContacts();
=======
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
    const user = await User.findOne({email: adminContact.email, del: false}).catch(err=>{
      console.log('admin user maching contact err ', err.message)
    })
    console.log('email', user.email)
    console.log('user.id', user.id)
    Contact.updateMany({_id: adminContact.id}, { $set: {source: user.id} }).catch(err=>{
      console.log('contact update error', err.message)
    })
  }
}

const update_contact = new CronJob('0 1 * * *', updateContacts,   function () {
  console.log('Reminder Job finished.');
}, false, 'US/Central')

const add_contact = new CronJob('0 2 * * *', addContacts,   function () {
  console.log('Reminder Job finished.');
}, false, 'US/Central')

update_contact.start()
add_contact.start()
//addContacts()
//sourceUpdate()
>>>>>>> master
