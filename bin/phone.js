const mongoose = require('mongoose');
const User = require('../models/user');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from
// const migrate = async() => {
//   const users = await User.find({del: true}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<users.length; i++){
//     const user = users[i]
//     if(user.proxy_number){
//       console.log(user.proxy_number)
//     }
//   }
// }
const migrate = async () => {
  const users = await User.find({
    del: true,
    'proxy_phone.is_released': false,
  }).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number) {
      const number = user.proxy_number;
      user['proxy_phone']['is_released'] = true;
      user
        .save()
        .then(() => {
          console.log(number);
        })
        .catch((err) => {
          console.err('err', err.message);
        });
    }
  }
};

const twilio = async () => {
  const users = await User.find({
    del: false,
  }).catch((err) => {
    console.log('err', err);
  });

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.proxy_number) {
      const number = user.proxy_number;
      user['twilio_number'] = number;
      user
        .save()
        .then(() => {
          console.log(number);
        })
        .catch((err) => {
          console.err('err', err.message);
        });
    }
  }
};

twilio();
