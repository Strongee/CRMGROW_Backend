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
            console.log('err1', user.email)
          }else{
            if( customer.subscriptions){
              const subscription = customer.subscriptions['data'][0]
              if(subscription && subscription['plan']){
                if(subscription['plan'].id != 'plan_FFnfPJc8bPYCZi'){
                    stripe.subscriptions.update(payment['subscription'], {
                      cancel_at_period_end: false,
                      items: [{
                        id: subscription.items.data[0].id,
                        plan: 'plan_FFnfPJc8bPYCZi',
                      }]
                    }, function(err, subscription){
                      if(err){
                        console.log('err', err)
                      } else {
                        payment['plan_id'] = 'plan_FFnfPJc8bPYCZi'
                        payment['bill_amount'] = '29'
                        payment.save().catch(err=>{
                          console.log('err', err)
                        })
                      }
                    });
                  // stripe.subscriptions.del(payment['subscription'], function (err, confirmation) {
                  //   if (err != null)  {
                  //     console.log('deleting subscription err', err)
                  //   }
                  // })
                  // stripe.subscriptions.create({
                  //     customer: payment['customer_id'],
                  //     items: [
                  //         { plan: 'plan_FFnfPJc8bPYCZi' }
                  //     ],
                  //     default_source: payment['card_id']
                  // }, function (err, subscription) {
                  //     if (err != null) {
                  //       console.log('creating subscription err', err)
                  //     }else{
                  //       payment['subscription'] = subscription.id
                  //       payment['plan_id'] = 'plan_FFnfPJc8bPYCZi'
                  //       payment['bill_amount'] = '29'
                  //       payment.save().then(()=>{
                  //         console.log(user.email)
                  //       }).catch(err=>{
                  //         console.log('err', err)
                  //       })
                  //     }
                  // });
                }
              }else{
                console.log('err2', user.email)
              }
            }else{
              console.log('err3', user.email)
            }
          }
        }
      );
 
   
  //  const user = await User.findOne({del: false, email: 'shon@shonkokoszka.com'}).catch(err=>{
  //   console.log('err', err)
  // })
  
  //       const payment = await Payment.findOne({_id: user.payment}).catch(err=>{
  //       console.log('err', err)
  //     })
  //       stripe.customers.retrieve(
  //         payment.customer_id,
  //       function(err, customer) {
  //         if(err){
  //           console.log('err1', err)
  //         }else{
  //           console.log('customer', customer)
  //           if( customer.subscriptions){
  //             const subscription = customer.subscriptions['data'][0]
  //             if(subscription && subscription['plan']){
  //               console.log('subscription', subscription)
  //               if(subscription['plan'].id != 'plan_FFnfPJc8bPYCZi'){
  //                 customerlist.push(customer)
  //               }
  //             }else{
  //               console.log('err2', subscription)
  //             }
  //           }else{
  //             console.log('err3', customer)
  //           }
          }
        }
  //     );
 }
migrate();