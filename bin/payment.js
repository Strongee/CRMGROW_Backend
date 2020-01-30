// const mongoose = require('mongoose');
// const Payment = require('../models/payment')
// const { DB_PORT } = require('../config/database');

// mongoose.set('useCreateIndex', true)
// mongoose.connect(DB_PORT, {useNewUrlParser: true})
// .then(() => console.log('Connecting to database successful'))
// .catch(err => console.error('Could not connect to mongo DB', err))
// //Fetch or read data from
// const migrate = async() => {
//   const payments = await Payment.find({}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<payments.length; i++){
//     const payment = payments[i]
//     if(payment['card']){
//       payment['card_id'] = payment['card']
//       payment.save().catch(err=>{
//         console.log('err', err)
//       })
//     }
//   }
// }
// migrate();

const mongoose = require('mongoose');
const Payment = require('../models/payment')
const User = require('../models/user')
const { DB_PORT } = require('../config/database');
const config = require('../config/config')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))
//Fetch or read data from
const migrate = async() => {
  const payments = await Payment.find({plan_id: 'plan_G5y3Wz6NbVZyQT'}).catch(err=>{
    console.log('err', err)
  })
  for(let i=0; i<payments.length; i++){
    const payment = payments[i]
    const user = await User.findOne({payment: payment.id, del: false})
   
    if(user.email == 'Scott.Ficinus@exprealty.com'){
      console.log(user.email)
      
        new Promise(function (resolve, reject) {
          stripe.subscriptions.update({
              customer: payment['customer_id'],
              items: [
                  { plan: 'plan_FFnfPJc8bPYCZi' }
              ],
              default_source: payment['card_id']
          }, function (err, subscription) {
              console.log('creating subscription err', err)
              if (err != null) {
                 console.log('err', err)
              }
              payment['plan_id'] = 'plan_FFnfPJc8bPYCZi'
              payment['bill_amount'] = '29'
              payment.save().catch(err=>{
                console.log('err', err)
              })
              resolve(subscription);
          });
      });
    }
  }
}
migrate();