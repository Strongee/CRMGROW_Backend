const config = require('../config/config')
const Payment = require('../models/payment')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)


const get = async(req, res) => {
  const { currentUser } = req
  const data = await Payment.findOne({user :currentUser.id});
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Payment doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const create = async(payment_data) => {
    return new Promise(function (resolve, reject) {
        const {email, bill_amount, token} = payment_data
        findOrcreateCustomer(email).then(customer => {
            stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
                console.log('card', card)
                console.log('err', err)
                if(card == null || typeof card == 'undefined'){
                    reject('Card is null');
                    return
                }
                if(card['cvc_check'] == 'unchecked'){
                    reject('CVC is unchecked');
                    return
                }

                let pricingPlan
                // const product = config.STRIPE.PRODUCT_ID
                if(bill_amount == config.STRIPE.PRIMARY_PLAN_AMOUNT){
                    pricingPlan = config.STRIPE.PRIMARY_PLAN
                }else{
                    pricingPlan = config.STRIPE.SUPER_PLAN
                }
                createSubscription(customer.id, pricingPlan, card.id)
                .then(subscription => {
                    console.log('subscription', subscription)
                    return subscription})
                .catch((e)=>{
                    console.log('creating subscripition error', e)
                }).then(async(result) => {
                    // Save card information to DB.
                    const payment = new Payment({
                        customer_id: customer.id,
                        plan_id: pricingPlan,
                        token: token.id,
                        card_brand: token.card.brand,
                        exp_month: token.card.exp_month,
                        exp_year: token.card.exp_year,
                        last4: token.card.last4,
                        active: true,
                        updated_at: new Date(),
                        created_at: new Date(),
                    })
                    
                    const _payment = await payment.save().then()
                    resolve(_payment)
                })
            });
        });
    })
}

const update = async(req, res) =>{
    const { bill_amount, token} = req.body
    const currentUser = req

	findOrcreateCustomer(currentUser.email).then(customer => {
		stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
            let pricingPlan
            // const product = config.STRIPE.PRODUCT_ID
                if(bill_amount == config.STRIPE.PRIMARY_PLAN_AMOUNT){
                    pricingPlan = config.STRIPE.PRIMARY_PLAN
                }else{
                    pricingPlan = config.STRIPE.SUPER_PLAN
                }
                createSubscription(customer.id, pricingPlan, card.id)
                    .then(subscription => {
                        // Save card information to DB.
                        const payment = Payment.findOne({id: currentUser.payment})
                        payment['plan_id'] = pricingPlan
                        payment['token'] = token.id
                        payment['card_brand'] = token.card.brand
                        payment['exp_month'] = token.card.exp_month
                        payment['exp_year'] = token.card.exp_year
                        payment['last4'] = token.card.last4
                        payment['updated_at'] = new Date()
                        payment['subscrip']
                        payment.save()
                        res.send({
                            status: true,
                          });
                        }).catch((e)=>{
                        console.log('creating subscripition error', e)
                    })
		});
	});
}
const findOrcreateCustomer = async(email) => {
    // Create new customer
    return new Promise(function (resolve, reject) {
        stripe.customers.list({email: email, limit: 1}, async (err, customers) => {
            if(err == null) {
                if (customers.data.length === 0) {
                    // create customer
                    stripe.customers.create({
                        email: email,
                    }, async (err, customer) => {
                        if (err) {
                            console.log('err', err)
                            reject(err);
                            return;
                        }
                        resolve(customer);
                    });
                } else {
                    // get the first customer
                    resolve(customers.data[0]);
                }							
            }else{
                console.log('err', err)
            }
        });
    });   
}

const createSubscription = async(customerId, planId, cardId) => {
    return new Promise(function (resolve, reject) {
        stripe.subscriptions.create({
            customer: customerId,
            items: [
                { plan: planId }
            ],
            default_source: cardId
        }, function (err, subscription) {
            if (err != null) {
                return reject(err);
            }
            resolve(subscription);
        });
    });
}

const cancelSubscription = async(subscription_id) => {
    return new Promise(function (resolve, reject) {
        stripe.subscriptions.del(subscription_id, function (err, confirmation) {
            if (err != null)  {
                return reject(err);
            }
            stripe.plans.del(confirmation.plan.id, function (err, confirmation) {
                if (err != null) {
                    return reject(err);
                }
                resolve(confirmation);
            });

        })
    });
}

const deleteCustomer = async(id) => {
    return new Promise(function (resolve, reject) {
        stripe.customers.del(id, function (err, confirmation) {
            if (err) reject(err);
            resolve(confirmation);
        });
    });
}

module.exports = {
    get,
    create,
    update,
    cancelSubscription,
    deleteCustomer
}