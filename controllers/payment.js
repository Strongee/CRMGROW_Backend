const config = require('../config/config')
const Payment = require('../models/payment')
const User = require('../models/user')
const stripeKey = config.STRIPE.SECRET_KEY
const stripe = require('stripe')(stripeKey)


const get = async(req, res) => {
  const { currentUser } = req;
  if( !currentUser.payment || currentUser.payment == 'undefined' ) {
      return res.status(400).json({
          status: false,
          error: 'Payment doesn`t exist'
      })
  }
//   if (!req.params.id || req.params.id == 'undefined') {
//     return res.status(400).json({
//         status: false,
//         error: 'Payment doesn`t exist'
//     })
//   }
  
  const data = await Payment.findOne({_id :currentUser.payment}).catch(err=>{
    console.log('err', err)
  });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Payment doesn`t exist'
    })
  }
  if(data.plan_id == config.STRIPE.PRIMARY_PLAN){
    data['bill_amount'] = config.STRIPE.PRIMARY_PLAN_AMOUNT
  } else {
    data['bill_amount'] = config.STRIPE.PRIOR_PLAN_AMOUNT
  }
  data.save().catch(err=>{
    console.log('err', err)
  })
  
  res.send({
    status: true,
    data
  })
}

const create = async(payment_data) => {
    return new Promise(function (resolve, reject) {
        const {email, bill_amount, token} = payment_data
        createCustomer(email).then(customer => {
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
                    pricingPlan = config.STRIPE.PRIOR_PLAN
                }
                createSubscription(customer.id, pricingPlan, card.id)
                .then(async(subscripition) => {
                    // Save card information to DB.  
                    const payment = new Payment({
                        email: email,
                        customer_id: customer.id,
                        plan_id: pricingPlan,
                        token: token.id,
                        subscription: subscripition.id,
                        bill_amount: bill_amount,
                        card_id: card.id,
                        card_name: token.card_name,
                        card_brand: token.card.brand,
                        fingerprint: card.fingerprint,
                        exp_month: token.card.exp_month,
                        exp_year: token.card.exp_year,
                        last4: token.card.last4,
                        active: true,
                        updated_at: new Date(),
                        created_at: new Date(),
                    })
                    
                    const _payment = await payment.save().then().catch(err=>{
                        console.log('err', err)
                    })
                    resolve(_payment)
                }).catch(err=>{
                    reject(err)
                })
            });
        });
    })
}

const update = async(req, res) =>{
    const { plan_id, token} = req.body
    const { currentUser } = req
    if(!currentUser.payment){
        createCustomer(currentUser.email).then(async(customer)=>{
            stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
                if(card == null || typeof card == 'undefined'){
                    return res.send({
                        status: false,
                        error: "Card is not valid"
                    });
                }
                
                const pricingPlan = config.STRIPE.PRIMARY_PLAN;
                const bill_amount = config.STRIPE.PRIMARY_PLAN_AMOUNT;
                updateSubscription(customer.id, pricingPlan, card.id)
                        .then(subscription => {
                            // Save card information to DB.

                            const payment = new Payment({
                                email: currentUser.email,
                                customer_id: customer.id,
                                plan_id: pricingPlan,
                                token: token.id,
                                card_id: card.id,
                                subscription: subscription.id,
                                card_brand: token.card.brand,
                                card_name: token.card_name,
                                exp_month: token.card.exp_month,
                                exp_year: token.card.exp_year,
                                last4: token.card.last4,
                                bill_amount: bill_amount,
                                fingerprint: card.fingerprint,
                                active: true,
                                updated_at: new Date(),
                                created_at: new Date(),
                            })

                            payment.save().then(_payment=>{
                                currentUser['payment'] = _payment.id
                                currentUser.save().then(()=>{
                                    return res.send({
                                        status: true,
                                        data: _payment.id
                                    });
                                }).catch(err=>{
                                    console.log('err', err)
                                })
                            })
                            }).catch((err)=>{
                            console.log('creating subscripition error', err)
                            return res.status(400).send({
                                status: false,
                                eror: err
                            })
                        })
            });
        }).catch(err=>{
            console.log('err', err)
        })
    }
    
    if(currentUser.payment){
        const payment = await Payment.findOne({_id: currentUser.payment}).catch(err=>{
            console.log('err', err)
        })
    
        console.log('payment', payment)
        if(!payment){
            createCustomer(email).then(async(customer)=>{
                stripe.customers.createSource(customer.id, {source: token.id}, function(err, card) {
                    if(!card){
                        return res.send({
                            status: false,
                            error: "Card is not valid"
                        });
                    }
                    
                    const pricingPlan = config.STRIPE.PRIMARY_PLAN;
                    const bill_amount = config.STRIPE.PRIMARY_PLAN_AMOUNT;
                    updateSubscription(customer.id, pricingPlan, card.id)
                            .then(subscription => {
                                // Save card information to DB.
    
                                const payment = new Payment({
                                    email: currentUser.email,
                                    customer_id: customer.id,
                                    plan_id: pricingPlan,
                                    token: token.id,
                                    card_id: card.id,
                                    subscription: subscription.id,
                                    card_brand: token.card.brand,
                                    card_name: token.card_name,
                                    exp_month: token.card.exp_month,
                                    exp_year: token.card.exp_year,
                                    fingerprint: card.fingerprint,
                                    last4: token.card.last4,
                                    bill_amount: bill_amount,
                                    active: true,
                                    updated_at: new Date(),
                                    created_at: new Date(),
                                })
    
                                payment.save().then(_payment=>{
                                    currentUser['payment'] = _payment.id
                                    currentUser.save().then(()=>{
                                        return res.send({
                                            status: true,
                                            data: _payment.id
                                        });
                                    }).catch(err=>{
                                        console.log('err', err)
                                    })
                                })
                                }).catch((err)=>{
                                console.log('creating subscripition error', err)
                                return res.status(400).send({
                                    status: false,
                                    eror: err
                                })
                            })
                });
            }).catch(err=>{
                console.log('err', err)
            })
        } 
        else{
            stripe.tokens.retrieve(
                token.id,
                function(err, _token) {
                  // asynchronously called
                console.log('_**********', _token)
                if(!_token){
                    return res.send({
                        status: false,
                        error: "Card is not valid"
                    });
                }
                if(payment['fingerprint'] != _token.card.fingerprint){
                    console.log('_token.card', _token.card)
                    stripe.customers.deleteSource(
                        payment['customer_id'],
                        payment['card_id'],
                        function(err, confirmation) {})
        
                    cancelSubscription(payment['subscription']).catch(err=>{
                        console.log('err', err)
                    })
        
                    stripe.customers.createSource(payment['customer_id'], {source: token.id}, function(err, card) {
                        if(card == null || typeof card == 'undefined'){
                            return res.send({
                                status: false,
                                error: "Card is not valid"
                            });
                        }
            
                            updateSubscription(payment['customer_id'], plan_id, card.id).then(subscription => {
                                // Save card information to DB.
                                payment['plan_id'] = plan_id
                                payment['token'] = token.id
                                payment['card_id'] = card.id
                                payment['card_name'] = token.card_name
                                payment['card_brand'] = token.card.brand
                                payment['exp_month'] = token.card.exp_month
                                payment['exp_year'] = token.card.exp_year
                                payment['last4'] = token.card.last4
                                payment['subscription'] = subscription.id
                                payment['fingerprint'] = card.fingerprint
                                payment['updated_at'] = new Date()
                                payment.save()
                     
                                return res.send({
                                            status: true,
                                            data: currentUser.payment
                                        });
                            }).catch((err)=>{
                                console.log('creating subscripition error', err)
                                return res.status(400).send({
                                    status: false,
                                    eror: err
                                })              
                            })
                    });
            }
            else{
                
                const customer_id = payment['customer_id']
                const card = token.card
                const card_id = payment['card_id']
                console.log('card_id', card_id)
                console.log('card***********', token.card)
                console.log('customer_id', customer_id)
                updateCard(customer_id, card_id, {name: token.card_name})
                    .then(_card=>{
                    console.log('card', _card)
                    // Save card information to DB.
                        payment['card_name'] = token.card_name
                        payment['card_brand'] = token.card.brand
                        payment['exp_month'] = token.card.exp_month
                        payment['exp_year'] = token.card.exp_year
                        payment['last4'] = token.card.last4
                        payment['updated_at'] = new Date()
                        payment.save().catch(err=>{
                            console.log('err', err)
                        })
                    
                    return res.send({
                        status: true,
                        data: currentUser.payment
                    });
                }).catch(err=>{
                    return res.status(400).send({
                        status: false,
                        error: err
                    })
                })
                
            }
        });
    } 
    }
}

const updateCustomerEmail = async(customer_id, email) => {
    // Create new customer
    return new Promise(function (resolve, reject) {
        stripe.customers.update(customer_id, {metadata: {email: email}}, async (err) => {
            if (err) {
                console.log('err', err)
                reject(err);
                return;
            }
            resolve();
        });
    });   
}

const createCustomer = async(email) => {
    return new Promise(function (resolve, reject) {
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
    })
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

const updateSubscription = async(customerId, planId, cardId) => {
    return new Promise(function (resolve, reject) {
        stripe.subscriptions.create({
            customer: customerId,
            items: [
                { plan: planId }
            ],
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
        stripe.customers.updateSource(
            customerId,
            cardId,
            data,
            function (err, card) {
                if(err){
                    console.log('err', err)
                    reject(err)
                }
                resolve(card);
            }
        );
    });
}

const cancelCustomer = async(id) => {
    const payment = await Payment.findOne({_id: id}).catch(err=>{
        console.log('err', err)
    })
    return new Promise((resolve, reject)=>{
        cancelSubscription(payment.subscription).then(()=>{
            deleteCustomer(payment.customer_id).then(()=>{
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

const paymentFailed = async(req, res) => {
    const invoice = req.body.data
    const customer_id = invoice['object']['customer']
    const attempt_count = invoice['object']['attempt_count']
    const payment = await Payment.findOne({customer_id: customer_id}).catch(err=>{
      console.log('err', err)
    })
    const user = await User.findOne({payment: payment, del: false}).catch(err=>{
      console.log('err', err)
    })
    
    user['subscription']['is_failed'] = true
    user['subscription']['updated_at'] = new Date()
    user['subscription']['attempt_count'] = attempt_count
    user['updated_at'] = new Date()
    
    if(attempt_count === 4){
        user['subscription']['is_suspended'] = true
        user['subscription']['suspended_at'] = new Date()
    }
    user.save().catch(err=>{
        console.log('err', err)
    })
    
    return res.send({
      status: true
    })
}
    
const paymentSucceed = async(req, res) => {
    const invoice = req.body.data
    const customer_id = invoice['object']['customer']
    const payment = await Payment.findOne({customer_id: customer_id}).catch(err=>{
      console.log('err', err)
    })
    const user = await User.findOne({payment: payment, del: false}).catch(err=>{
      console.log('err', err)
    })
    
    user['subscription']['is_failed'] = false
    user['subscription']['updated_at'] = new Date()

    user['updated_at'] = new Date()

    user.save().catch(err=>{
        console.log('err', err)
    })
    
    return res.send({
      status: true
    })
}    

module.exports = {
    get,
    create,
    update,
    cancelCustomer,
    paymentFailed,
    paymentSucceed,
    updateCustomerEmail,
    cancelSubscription,
    deleteCustomer
}