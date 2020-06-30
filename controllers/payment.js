const api = require('../config/api');
const system_settings = require('../config/system_settings');
const Payment = require('../models/payment');
const User = require('../models/user');

const stripeKey = api.STRIPE.SECRET_KEY;

const stripe = require('stripe')(stripeKey);

const get = async (req, res) => {
  const { currentUser } = req;
  if (!currentUser.payment || currentUser.payment === 'undefined') {
    return res.status(400).json({
      status: false,
      error: 'Payment doesn`t exist',
    });
  }
  //   if (!req.params.id || req.params.id == 'undefined') {
  //     return res.status(400).json({
  //         status: false,
  //         error: 'Payment doesn`t exist'
  //     })
  //   }

  const data = await Payment.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Payment doesn`t exist',
    });
  }
  data['bill_amount'] = system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;

  data.save().catch((err) => {
    console.log('err', err);
  });

  res.send({
    status: true,
    data,
  });
};

const create = async (payment_data) => {
  return new Promise(function (resolve, reject) {
    const { email, token, referral } = payment_data;
    createCustomer(email, referral).then((customer) => {
      stripe.customers.createSource(
        customer.id,
        { source: token.id },
        function (err, card) {
          if (card == null || typeof card === 'undefined') {
            reject('Card is null');
            return;
          }
          if (card['cvc_check'] === 'unchecked') {
            reject('CVC is unchecked');
            return;
          }

          const bill_amount = system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;
          const pricingPlan = api.STRIPE.PRIOR_PLAN;
          createSubscription(customer.id, pricingPlan, card.id)
            .then(async (subscripition) => {
              // Save card information to DB.
              const payment = new Payment({
                email,
                customer_id: customer.id,
                plan_id: pricingPlan,
                token: token.id,
                subscription: subscripition.id,
                bill_amount,
                card_id: card.id,
                card_name: token.card_name,
                card_brand: token.card.brand,
                fingerprint: card.fingerprint,
                exp_month: token.card.exp_month,
                exp_year: token.card.exp_year,
                last4: token.card.last4,
                active: true,
                referral,
                updated_at: new Date(),
                created_at: new Date(),
              });

              const _payment = await payment
                .save()
                .then()
                .catch((err) => {
                  console.log('err', err);
                });
              resolve(_payment);
            })
            .catch((err) => {
              reject(err);
            });
        }
      );
    });
  });
};

const update = async (req, res) => {
  const { token } = req.body;
  const { currentUser } = req;
  if (!currentUser.payment) {
    createCustomer(currentUser.email)
      .then(async (customer) => {
        stripe.customers.createSource(
          customer.id,
          { source: token.id },
          function (err, card) {
            if (card == null || typeof card === 'undefined') {
              return res.status(400).send({
                status: false,
                error: 'Card is not valid',
              });
            }

            const pricingPlan = api.STRIPE.PRIOR_PLAN;
            const bill_amount = system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;
            updateSubscription(customer.id, pricingPlan, card.id)
              .then((subscription) => {
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
                  bill_amount,
                  fingerprint: card.fingerprint,
                  active: true,
                  updated_at: new Date(),
                  created_at: new Date(),
                });

                payment.save().then((_payment) => {
                  currentUser['payment'] = _payment.id;
                  currentUser
                    .save()
                    .then(() => {
                      return res.send({
                        status: true,
                        data: _payment.id,
                      });
                    })
                    .catch((err) => {
                      console.log('err', err);
                    });
                });
              })
              .catch((err) => {
                console.log('creating subscripition error', err);
                return res.status(400).send({
                  status: false,
                  eror: err,
                });
              });
          }
        );
      })
      .catch((err) => {
        console.log('err', err);
      });
  }

  if (currentUser.payment) {
    const payment = await Payment.findOne({ _id: currentUser.payment }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (!payment) {
      createCustomer(currentUser.email)
        .then(async (customer) => {
          stripe.customers.createSource(
            customer.id,
            { source: token.id },
            function (err, card) {
              if (!card) {
                return res.status(400).send({
                  status: false,
                  error: 'Card is not valid',
                });
              }

              const pricingPlan = api.STRIPE.PRIOR_PLAN;
              const bill_amount =
                system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;
              updateSubscription(customer.id, pricingPlan, card.id)
                .then((subscription) => {
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
                    bill_amount,
                    active: true,
                    updated_at: new Date(),
                    created_at: new Date(),
                  });

                  payment.save().then((_payment) => {
                    currentUser['payment'] = _payment.id;
                    currentUser
                      .save()
                      .then(() => {
                        return res.send({
                          status: true,
                          data: _payment.id,
                        });
                      })
                      .catch((err) => {
                        console.log('err', err);
                      });
                  });
                })
                .catch((err) => {
                  console.log('creating subscripition error', err);
                  return res.status(400).send({
                    status: false,
                    eror: err,
                  });
                });
            }
          );
        })
        .catch((err) => {
          console.log('err', err);
        });
    } else {
      stripe.customers.retrieve(payment['customer_id'], function (
        err,
        customer
      ) {
        if (err || customer['deleted']) {
          console.log('customer retrieve error', err);
          createCustomer(currentUser.email)
            .then(async (customer) => {
              stripe.customers.createSource(
                customer.id,
                { source: token.id },
                function (err, card) {
                  if (!card) {
                    return res.status(400).send({
                      status: false,
                      error: 'Card is not valid',
                    });
                  }

                  const pricingPlan = api.STRIPE.PRIOR_PLAN;
                  const bill_amount =
                    system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;
                  updateSubscription(customer.id, pricingPlan, card.id)
                    .then((subscription) => {
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
                        bill_amount,
                        active: true,
                        updated_at: new Date(),
                        created_at: new Date(),
                      });

                      payment.save().then((_payment) => {
                        currentUser['payment'] = _payment.id;
                        currentUser
                          .save()
                          .then(() => {
                            return res.send({
                              status: true,
                              data: _payment.id,
                            });
                          })
                          .catch((err) => {
                            console.log('err', err);
                          });
                      });
                    })
                    .catch((err) => {
                      console.log('creating subscripition error', err);
                      return res.status(400).send({
                        status: false,
                        eror: err,
                      });
                    });
                }
              );
            })
            .catch((err) => {
              console.log('err', err);
            });
        } else {
          stripe.tokens.retrieve(token.id, function (err, _token) {
            console.log('_token', token);
            // asynchronously called
            if (!_token) {
              return res.status(400).send({
                status: false,
                error: 'Card is not valid',
              });
            }
            if (payment['fingerprint'] !== _token.card.fingerprint) {
              stripe.customers.createSource(
                payment['customer_id'],
                { source: token.id },
                function (err, card) {
                  if (!card) {
                    return res.status(400).send({
                      status: false,
                      error: 'Card is not valid',
                    });
                  }
                  const pricingPlan = api.STRIPE.PRIOR_PLAN;
                  const bill_amount =
                    system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;

                  updateSubscription(
                    payment['customer_id'],
                    pricingPlan,
                    card.id
                  )
                    .then((subscription) => {
                      console.log('update Subscription', subscription);
                      cancelSubscription(payment['subscription']).catch(
                        (err) => {
                          console.log('cancel subscription err', err);
                        }
                      );
                      try {
                        stripe.customers.deleteSource(
                          payment['customer_id'],
                          payment['card_id'],
                          function (err, confirmation) {
                            if (err) {
                              console.log('delete source err', err);
                            }
                          }
                        );
                        // Save card information to DB.
                        payment['plan_id'] = pricingPlan;
                        payment['bill_amount'] = bill_amount;
                        payment['token'] = token.id;
                        payment['card_id'] = card.id;
                        payment['card_name'] = token.card_name;
                        payment['card_brand'] = token.card.brand;
                        payment['exp_month'] = token.card.exp_month;
                        payment['exp_year'] = token.card.exp_year;
                        payment['last4'] = token.card.last4;
                        payment['subscription'] = subscription.id;
                        payment['fingerprint'] = card.fingerprint;
                        payment['updated_at'] = new Date();
                        payment.save().catch((err) => {
                          console.log('err', err);
                        });
                        return res.send({
                          status: true,
                          data: currentUser.payment,
                        });
                      } catch (err) {
                        console.log('delete card err', err);
                      }
                    })
                    .catch((err) => {
                      console.log('creating subscripition error', err);
                      return res.status(400).send({
                        status: false,
                        eror: err,
                      });
                    });
                }
              );
            } else {
              const customer_id = payment['customer_id'];
              const card_id = payment['card_id'];
              stripe.customers.retrieveSource(customer_id, card_id, function (
                err,
                card
              ) {
                if (err) {
                  stripe.customers.createSource(
                    payment['customer_id'],
                    { source: token.id },
                    function (err, card) {
                      console.log('_card', card);
                      if (err || !card) {
                        return res.status(400).send({
                          status: false,
                          error: 'Card is not valid',
                        });
                      }
                      const pricingPlan = api.STRIPE.PRIOR_PLAN;
                      const bill_amount =
                        system_settings.SUBSCRIPTION_MONTHLY_PLAN.BASIC;

                      updateSubscription(
                        payment['customer_id'],
                        pricingPlan,
                        card.id
                      )
                        .then((subscription) => {
                          console.log('update Subscription', subscription);
                          cancelSubscription(payment['subscription']).catch(
                            (err) => {
                              console.log('cancel subscription err', err);
                            }
                          );
                          try {
                            // Save card information to DB.
                            payment['plan_id'] = pricingPlan;
                            payment['bill_amount'] = bill_amount;
                            payment['token'] = token.id;
                            payment['card_id'] = card.id;
                            payment['card_name'] = token.card_name;
                            payment['card_brand'] = token.card.brand;
                            payment['exp_month'] = token.card.exp_month;
                            payment['exp_year'] = token.card.exp_year;
                            payment['last4'] = token.card.last4;
                            payment['subscription'] = subscription.id;
                            payment['fingerprint'] = card.fingerprint;
                            payment['updated_at'] = new Date();
                            payment.save().catch((err) => {
                              console.log('err', err);
                            });
                            return res.send({
                              status: true,
                              data: currentUser.payment,
                            });
                          } catch (err) {
                            console.log('delete card err', err);
                          }
                        })
                        .catch((err) => {
                          console.log('creating subscripition error', err);
                          return res.status(400).send({
                            status: false,
                            eror: err,
                          });
                        });
                    }
                  );
                } else {
                  const card = {
                    name: token.card.name,
                    exp_month: token.card.exp_month,
                    exp_year: token.card.exp_year,
                  };

                  delete card.id;

                  updateCard(customer_id, card_id, card)
                    .then((_card) => {
                      // Save card information to DB.
                      payment['card_name'] = token.card_name;
                      payment['card_brand'] = token.card.brand;
                      payment['exp_month'] = token.card.exp_month;
                      payment['exp_year'] = token.card.exp_year;
                      payment['last4'] = token.card.last4;
                      payment['updated_at'] = new Date();
                      payment.save().catch((err) => {
                        console.log('err', err);
                      });

                      return res.send({
                        status: true,
                        data: currentUser.payment,
                      });
                    })
                    .catch((err) => {
                      return res.status(400).send({
                        status: false,
                        error: err,
                      });
                    });
                }
              });
            }
          });
        }
      });
    }
  }
};

const updateCustomerEmail = async (customer_id, email) => {
  // Create new customer
  return new Promise(function (resolve, reject) {
    stripe.customers.update(
      customer_id,
      { metadata: { email } },
      async (err) => {
        if (err) {
          console.log('err', err);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
};

const createCustomer = async (email, referral) => {
  return new Promise((resolve, reject) => {
    stripe.customers.create(
      {
        email,
        metadata: { referral },
      },
      async (err, customer) => {
        if (err) {
          console.log('err', err);
          reject(err);
          return;
        }
        resolve(customer);
      }
    );
  });
};

const createSubscription = async (customerId, planId, cardId) => {
  return new Promise(function (resolve, reject) {
    stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ plan: planId }],
        trial_period_days: 7,
        default_source: cardId,
      },
      function (err, subscription) {
        console.log('creating subscription err', err);
        if (err != null) {
          return reject(err);
        }
        resolve(subscription);
      }
    );
  });
};

const updateSubscription = async (customerId, planId, cardId) => {
  return new Promise(function (resolve, reject) {
    stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ plan: planId }],
        default_source: cardId,
      },
      function (err, subscription) {
        console.log('creating subscription err', err);
        if (err != null) {
          return reject(err);
        }
        resolve(subscription);
      }
    );
  });
};

const cancelSubscription = async (subscription_id) => {
  return new Promise(function (resolve, reject) {
    stripe.subscriptions.del(subscription_id, function (err, confirmation) {
      if (err != null) {
        return reject(err);
      }
      resolve();
    });
  });
};

/**
 *
 * @param {customer id} id
 */
const deleteCustomer = async (id) => {
  return new Promise(function (resolve, reject) {
    stripe.customers.del(id, function (err, confirmation) {
      if (err) reject(err);
      resolve(confirmation);
    });
  });
};

/**
 *
 * @param {customer id} customerId
 * @param {cart id} cardId
 * @param {data} data
 * @qutation update card
 */
const updateCard = async (customerId, cardId, data) => {
  return new Promise(function (resolve, reject) {
    stripe.customers.updateSource(customerId, cardId, data, function (
      err,
      card
    ) {
      if (err) {
        console.log('err', err);
        reject(err);
      }
      resolve(card);
    });
  });
};

const cancelCustomer = async (id) => {
  const payment = await Payment.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });
  return new Promise((resolve, reject) => {
    cancelSubscription(payment.subscription)
      .then(() => {
        deleteCustomer(payment.customer_id)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            console.log('err', err);
            reject();
          });
      })
      .catch((err) => {
        console.log('err', err);
        reject();
      });
  });
};

const paymentFailed = async (req, res) => {
  const invoice = req.body.data;
  const customer_id = invoice['object']['customer'];
  const attempt_count = invoice['object']['attempt_count'];

  const payment = await Payment.findOne({
    customer_id,
  }).catch((err) => {
    console.log('payment find err', err.message);
  });

  const user = await User.findOne({
    payment,
    del: false,
  }).catch((err) => {
    console.log('user find err', err.message);
  });

  user['subscription']['is_failed'] = true;
  user['subscription']['updated_at'] = new Date();
  user['subscription']['attempt_count'] = attempt_count;
  user['updated_at'] = new Date();

  if (attempt_count === 4) {
    user['subscription']['is_suspended'] = true;
    user['subscription']['suspended_at'] = new Date();
  }

  user.save().catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const paymentSucceed = async (req, res) => {
  const invoice = req.body.data;
  const customer_id = invoice['object']['customer'];
  const payment = await Payment.findOne({ customer_id }).catch((err) => {
    console.log('err', err);
  });
  const user = await User.findOne({ payment: payment.id, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  if (user) {
    user['subscription']['is_failed'] = false;
    user['subscription']['attempt_count'] = 0;
    user['subscription']['is_suspended'] = false;
    user['subscription']['updated_at'] = new Date();

    const max_text_count =
      user['text_info']['max_count'] ||
      system_settings.TEXT_MONTHLY_LIMIT.BASIC;
    user['text_info']['count'] = max_text_count;

    user.save().catch((err) => {
      console.log('user save err', err.message);
    });
    return res.send({
      status: true,
    });
  } else {
    console.log('Payment not found for user: ', customer_id);
    return res.status(400).json({
      status: false,
      error: `Couldn't find user ${customer_id}`,
    });
  }
};

module.exports = {
  get,
  create,
  update,
  cancelCustomer,
  paymentFailed,
  paymentSucceed,
  updateCustomerEmail,
  cancelSubscription,
  deleteCustomer,
};
