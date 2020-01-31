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
//   const payments = await Payment.find({plan_id: 'plan_G5y3Wz6NbVZyQT'}).catch(err=>{
//     console.log('err', err)
//   })
//   for(let i=0; i<5; i++){
//     const payment = payments[i]
//     const user = await User.findOne({payment: payment.id, del: false})
//     if(user){
//       stripe.subscriptions.del(payment['subscription'], function (err, confirmation) {
//         if (err != null)  {
//           console.log('deleting subscription err', err)
//         }
//       })
//       stripe.subscriptions.create({
//           customer: payment['customer_id'],
//           items: [
//               { plan: 'plan_FFnfPJc8bPYCZi' }
//           ],
//           default_source: payment['card_id']
//       }, function (err, subscription) {
//           if (err != null) {
//             console.log('creating subscription err', err)
//           }else{
//             payment['subscription'] = subscription.id
//             payment['plan_id'] = 'plan_FFnfPJc8bPYCZi'
//             payment['bill_amount'] = '29'
//             payment.save().then(()=>{
//               console.log(user.email)
//             }).catch(err=>{
//               console.log('err', err)
//             })
//           }
//       });
//     }
//   }
// }

  let error = []
  let customerlist = []
  
  const users = await User.find({del: false}).catch(err=>{
    console.log('err', err)
  })
  
  for(let i=0; i<users.length; i++){
    const user = users[i]
    if(user.payment){
      const payment = await Payment.findOne({_id: user.payment}).catch(err=>{
        console.log('err', err)
      })
      
      const customer_id = payment['customer_id']
      stripe.customers.retrieve(
        customer_id,
        function(err, customer) {
          if(err){
            error.push(user.email)
          }else{
            if( customer.subscriptions){
              const subscription = customer.subscriptions['data'][0]
              if(subscription){
                if(subscription['plan'].id != 'plan_FFnfPJc8bPYCZi'){
                  customerlist.push(user.email)
                }
              }else{
                error.push(user.email)
              }
            }else{
              error.push(user.email)
            }
          }
        }
      );
    }  
  }
  console.log('errors', error)
  console.log('customers', customerlist)
}
migrate();