const config = require('../../config/config')
const Payment = require('../../models/payment')
const User = require('../../models/user')
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

module.exports = {
  getTransactions,
  getCustomers
}