const mongoose = require('mongoose');
const User = require('../models/user');
const Garbage = require('../models/garbage');
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))

const migrate = async() => {
  const users = await User.find({del: false}).catch(err=>{
    console.log('err', err)
  })
  for(let i=0; i<users.length; i++){
    const user = users[i]
    Garbage.findOneOrCreate({
      user: user.id
    },{
      user: user.id,
      created_at: new Date(),
      updated_at: new Date()
    }).then(res=>{
      console.log('data', res)
    }).catch(err=>{
      console.log('err', err)
    })
  }
}
migrate();