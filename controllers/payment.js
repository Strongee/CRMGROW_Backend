const config = require('../config/config')
const Payment = require('../models/payment')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)


const get = async(req, res) => {
  const data = await Payment.findOne({_id :req.params.id});
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
                .then(async(subscripition) => {
                    // Save card information to DB.
                    const payment = new Payment({
                        customer_id: customer.id,
                        plan_id: pricingPlan,
                        token: token.id,
                        subscription: subscripition.id,
                        card: card.id,
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
                }).catch(err=>{
                    reject(err)
                })
            });
        });
    })
}

const update = async(req, res) =>{
    const { bill_amount, token} = req.body
    const { currentUser } = req

	findOrcreateCustomer(currentUser.email).then(async(customer) => {
        const payment = await Payment.findOne({customer_id: customer.id})
        if(payment == null){
            stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
                if(card == null || typeof card == 'undefined'){
                    return res.send({
                        status: true,
                        error: "Card is not valid"
                    });
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
                            // Save card information to DB.

                            const payment = new Payment({
                                customer_id: customer.id,
                                plan_id: pricingPlan,
                                token: token.id,
                                card: card.id,
                                subscription: subscription.id,
                                card_brand: token.card.brand,
                                exp_month: token.card.exp_month,
                                exp_year: token.card.exp_year,
                                last4: token.card.last4,
                                active: true,
                                updated_at: new Date(),
                                created_at: new Date(),
                            })

                            payment.save()
                            
                            return res.send({
                                    status: true,
                                });
                            }).catch((err)=>{
                            console.log('creating subscripition error', err)
                            return res.status(400).send({
                                status: false,
                                eror: err
                            })
                        })
            });
        }else if(payment['token'] != token.id){
            stripe.customers.deleteSource(
                payment['customer_id'],
                payment['card'],
                function(err, confirmation) {})

            cancelSubscription(payment['subscription'])

            stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
                if(card == null || typeof card == 'undefined'){
                    return res.send({
                        status: true,
                        error: "Card is not valid"
                    });
                }
             
                let pricingPlan
                // const product = config.STRIPE.PRODUCT_ID
                if(bill_amount == config.STRIPE.PRIMARY_PLAN_AMOUNT){
                    pricingPlan = config.STRIPE.PRIMARY_PLAN
                }else{
                    pricingPlan = config.STRIPE.SUPER_PLAN
                }
    
                    createSubscription(customer.id, pricingPlan, card.id).then(subscription => {
                        // Save card information to DB.
                        payment['plan_id'] = pricingPlan
                        payment['token'] = token.id
                        payment['card'] = card.id
                        payment['card_brand'] = token.card.brand
                        payment['exp_month'] = token.card.exp_month
                        payment['exp_year'] = token.card.exp_year
                        payment['last4'] = token.card.last4
                        payment['subscription'] = subscription.id
                        payment['updated_at'] = new Date()
        
                        payment.save()
             
                        return res.send({
                                    status: true,
                                });
                    }).catch((err)=>{
                        console.log('creating subscripition error', err)
                        return res.status(400).send({
                            status: false,
                            eror: err
                        })              
                    })
            });
        }else{
            const customer_id = customer.id
            const card = token.card
            const card_id = payment['card_id']

            updateCard(customer_id, card_id, card).then(card=>{
                // Save card information to DB.
                const payment = Payment.findOne({id: currentUser.payment})

                payment['plan_id'] = pricingPlan

                payment['card_brand'] = token.card.brand
                payment['exp_month'] = token.card.exp_month
                payment['exp_year'] = token.card.exp_year
                payment['last4'] = token.card.last4
                payment['updated_at'] = new Date()
                payment.save()

                res.send({
                    status: true,
                  });
            }).catch(err=>{
                res.status(400).send({
                    status: false,
                    error: err
                })
            })
        }
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
            trial_period_days: 7,
            default_source: cardId
        }, function (err, subscription) {
            console.log('creating subscription err', err)
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

/**
 * 
 * @param {customer id} customerId 
 * @param {cart id} cardId 
 * @param {data} data 
 * @qutation update card
 */
 const updateCard = async(customerId, cardId, data) => {
    return new Promise(function (resolve, reject) {
        stripe.customers.updateCard(
            customerId,
            cardId,
            data,
            function (err, card) {
                if (err) reject(err);
                resolve(card);
            }
        );
    });
}

module.exports = {
    get,
    create,
    update,
    cancelSubscription,
    deleteCustomer
}