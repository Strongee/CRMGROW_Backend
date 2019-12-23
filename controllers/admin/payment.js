const config = require('../../config/config')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)

const getTransactions = async(req, res) => {
  const customer_id = req.params.id
  stripe.charges.list(
    {customer: customer_id},
    function(err, charges) {
      if(err){
        console.log('err', err)
        return res.status(400).json({
          error: err
        })
      }
      const data = charges.data
      return res.send({
        status: true,
        data
      })
    }
  );
}

const getCustomers = async(req, res) => {
  stripe.customers.list(
    {limit: config.STRIPE.LIMIT},
    function(err, customers) {
      if(err){
        console.log('err', err)
        return res.status(400).json({
          error: err
        })
      }
      const data = customers.data
      return res.send({
        status: true,
        data
      })
    }
  );
}

const refundCharge = async(req, res) =>{

  stripe.refunds.create(
    {charge: req.params.id},
    function(err, refund) {
      // asynchronously called
    }
  );
}

const cancelCustomer = async(req, res) => {
  const payment = await Payment.findOne({customer_id: req.params.id}).catch(err=>{
      console.log('err', err)
  })
  return new Promise((resolve, reject)=>{
      cancelSubscription(payment.subscription).then(()=>{
          deleteCustomer(req.params.id).then(()=>{
              resolve()
          }).catch(err=>{
              console.log('err', err)
              reject()
          })
      }).catch(err=>{
          console.log('err', err)
          reject()
      })
  })
}

const cancelSubscription = async(subscription_id) => {
  return new Promise(function (resolve, reject) {
      stripe.subscriptions.del(subscription_id, function (err, confirmation) {
          if (err != null)  {
              return reject(err);
          }
          resolve()
      })
  });
}

/**
* 
* @param {customer id} id 
*/
const deleteCustomer = async(id) => {
  return new Promise(function (resolve, reject) {
      stripe.customers.del(id, function (err, confirmation) {
          if (err) reject(err);
          resolve(confirmation);
      });
  });
}

module.exports = {
  getTransactions,
  getCustomers,
  cancelCustomer,
  refundCharge
}