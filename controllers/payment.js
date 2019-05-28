const config = require('../config/config')
const Payment = require('../models/payment')
const User = require('../models/user')
const stripeKey = config.STRIPE.SECRET_KEH
const stripe = require('stripe')(stripeKey)


const get = async(req, res) => {
  const { currentUser } = req
  const query = {...req.query}
  const contact = query['contact']
  console.log('contact', contact)
  const data = await Note.find({user :currentUser.id, contact: contact});
  console.log('data', data);
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Note doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
	const billAmount = req.body.bill;
	const billCycle = config.STRIPE.BILLING_CYCLE;
	const {currentUser} = req
	const token = req.body.token;

	findOrcreateCustomer(currentUser.email).then(customer => {
        console.log('customer', customer)
		stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
            const product = config.STRIPE.PRODUCT_ID
            new Promise(function(resolve, reject) {
                stripe.plans.create({
                    currency: 'usd',
                    amount: billAmount,
                    interval: billCycle,
                    product: product
                }, function(err, plan) {
                    if (err) {
                        console.log('err', err)
                        reject(err)
                    }
                    resolve(plan)
                });
            }).then(newPricingPlan => {
                createSubscription(customerId, newPricingPlan.id, card.id)
                    .then(subscription => resolve(subscription))
                    .catch(err => {
                        console.log('err', err)
                        reject(err)
                    });
            }).then(result => {
                console.log('result', result)
                		// Save card information to DB.
                const payment = new Payment({
                    user: currentUser.id,
                    customer_id: customer.id,
                    plan_id: newPricingPlan.id,
                    token: token.id,
                    card_brand: token.card.brand,
                    exp_month: token.card.exp_month,
                    exp_year: token.card.exp_year,
                    last4: token.card.last4,
                    active: true,
                    updated_at: new Date(),
                    created_at: new Date(),
                })
                payment.save().then(_payment => {
                    res.send({
                        status: true,
                    })
                })
            })
			.catch(err => res.status(500).send({
                status: false,
                error: err
              }))
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


module.exports = {
    get,
    create,
}