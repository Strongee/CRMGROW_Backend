const config = require('../../config/config')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)
const Payment = require('../../models/payment')
const User = require('../../models/user')

const getCustomer = async(req, res) => {

  const customer_id = req.params.id
  const data = {
    email: '',
    created_at: '',
    subscription: '',
    subscribed_at: '',
    trial_ended: '',
    status: '',
    card: '',
    plan: ''
  }
  stripe.customers.retrieve(
    customer_id,
    function(err, customer) {
      if(err){
        return res.status(400).send({
          status: false,
          error: err
        })
      }
      console.log('subscription', customer.subscriptions['data'])
      const subscription = customer.subscriptions['data'][0]
      data['email'] = customer['email']
      data['created_at'] = new Date(customer['created_at']*1000)
      data['subscription'] = subscription['id']
      data['subscribed_at'] = new Date(subscription['created']*1000)
      data['trial_ended'] = new Date(subscription['trial_end']*1000)
      data['card'] = subscription['default_source']
      data['status'] = subscription['status']
      data['plan'] = subscription['plan'].id
      if(subscription['plan'].id == config.STRIPE.PRIOR_PLAN){
        data['bill_amount'] = '29'
      } else {
        data['bill_amount'] = '39'
      }
      return res.send({
        status: true,
        data
      })
    }
  );
}

const getUpcomingInvoice = async(req, res) => {
  const customer_id = req.params.id
  const data = {
    amount_due: '',
    created: ''
  }
  stripe.invoices.retrieveUpcoming(
    {customer: customer_id},
    function(err, upcoming) {
      if(err){
        return res.status(400).send({
          status: false,
          error: err
        })
      }
      data['amount_due'] = upcoming['amount_due']/100
      data['created'] = upcoming['created']
      return res.send({
        data,
        status: true
      })
    }
  );
}

const getTransactions = async(req, res) => {
  const customer_id = req.params.id
  stripe.charges.list(
    {customer: customer_id},
    function(err, charges) {
      if(err){
        console.log('err', err)
        return res.status(400).json({
          status: false,
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
    {
      limit: config.STRIPE.LIMIT,
      starting_after: req.params.id
    },
    async function(err, customers) {
      if(err){
        console.log('err', err)
        return res.status(400).json({
          status: false,
          error: err
        })
      }
      let data = []
      const payments = customers.data
      for(let i =0; i<payments.length; i++){
        const customer = payments[i]
        const payment = await Payment.findOne({customer_id: customer.id})
        if(payment){
          const _user = await User.findOne({payment: payment.id})
          if(_user){
            myJSON = JSON.stringify(_user)
            const user = JSON.parse(myJSON)
            user.payment = payment
            delete user.hash
            delete user.salt
            data.push(user)
          }else{
            console.log('customer id err:', customer.id)
          }
        }else{
          console.log('customer id err:', customer.id)
        }    
      }
      
      return res.send({
        status: true,
        data
      })
    }
  );
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
const refundCharge = async(req, res) =>{
  stripe.refunds.create(
    {charge: req.params.id},
    function(err, data) {
      if (err)  {
        return res.status(400).json({
                status: false,
                error: err
              })
      }
      
      return res.send({
              status: true,
              data
            })
    }
  );
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
const cancelSubscription = async(req, res) => {
  stripe.subscriptions.del(req.params.id, function (err, data) {
    if (err)  {
      return res.status(400).json({
              status: false,
              error: err
            })
    }
    
    return res.send({
            status: true,
            data
          })
    });
}

/**
* 
* @param {customer id} id 
*/
const cancelCustomer = async(req, res) => {
  stripe.customers.del(req.params.id, function (err, data) {
  if(err){
    console.log('err', err)
    return res.status(400).json({
      status: false,
      error: err
    })
  }
  
  return res.send({
          status: true,
          data
        })
  });
}

/**
 * 
 * @param {*} customer_id 
 * @param {*} card_id 
 * @param {*} data 
 */
 
const updateCard = async(req, res) => {
  const {customer_id, card_id, data} = req.body
  stripe.customers.updateSource( customer_id, card_id, data,
    function (err, data) {
      if(err){
        console.log('err', err)
        return res.status(400).json({
                status: false,
                error: err
              })
        }
        
        return res.send({
                status: true,
                data
              }) 
          }
      );
}
/**
 * 
 * @param {*} customer_id 
 * @param {*} plan_id 
 * @param {*} card_id 
 */
const updateSubscription = async(req, res) => {
  const {customer_id, plan_id, card_id} = req.body
  stripe.subscriptions.create({
    customer: customer_id,
    items: [{ plan: plan_id }],
    default_source: card_id
  }, function (err, data) {
    console.log('creating subscription err', err)
    if (err) {
      console.log('err', err)
        return res.status(400).json({
                status: false,
                error: err
              })
    }
    return res.send({
      status: true,
      data
    }) 
  });
}

/**
 * 
 * @param {*} customer_id 
 * @param {*} email 
 */
const updateCustomerEmail = async(req, res) => {
  const {customer_id, email} = req.body
  stripe.customers.update(customer_id, {metadata: {email: email}}, async (err) => {
    if (err) {
      console.log('err', err)
      return res.status(400).json({
              status: false,
              error: err
            })
    }
    return res.send({
      status: true,
    }) 
  });  
}


module.exports = {
  getCustomer,
  getCustomers,
  updateCustomerEmail,
  cancelCustomer,
  getUpcomingInvoice,
  getTransactions,
  refundCharge,
  updateCard,
  cancelSubscription,
  updateSubscription
}