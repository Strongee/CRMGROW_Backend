// const mongoose = require('mongoose');
// const User = require('../models/user')
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true)
// mongoose.connect(DB_PORT, {useNewUrlParser: true})
// .then(() => console.log('Connecting to database successful'))
// .catch(err => console.error('Could not connect to mongo DB', err))
// //Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     user['del'] = false
//     if(user.payment.length == 0){
//       user.payment = undefined
//     }
//     user.save().catch(err=>{
//       console.log('err', err)
//     })
//   }
// }
// migrate();
// const mongoose = require('mongoose');
// const User = require('../models/user')
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true)
// mongoose.connect(DB_PORT, {useNewUrlParser: true})
// .then(() => console.log('Connecting to database successful'))
// .catch(err => console.error('Could not connect to mongo DB', err))
// //Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     user['admin_loggin'] = false
//     user.save().catch(err=>{
//       console.log('err', err)
//     })
//   }
// }
// migrate();

const mongoose = require('mongoose');
const User = require('../models/user')
const Contact = require('../models/contact');
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from
const migrate = async() => {
  const users = await User.find({del: false}).catch(err=>{
    console.log('err', err)
  })
  const total = 0
  for(let i=0; i<users.length; i++){
    const user = users[i]
    const counts = await Contact.countDocuments({user: user.id})
    if(counts >= 1000){
      total++;
    }
  }
  console.log('total', total)
}
migrate();