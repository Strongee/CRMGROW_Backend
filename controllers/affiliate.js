const api = require('../config/api');

const request = require('request-promise');

const get = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL_API_KEY + ':').toString('base64');
    request({
      method: 'GET',
      uri: `https://api.getrewardful.com/v1/affiliates/${currentUser.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
      .then((response) => {
        return res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          err: err.details[0],
        });
      });
  } else {
    res.send({
      status: true,
      data: {},
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL_API_KEY + ':').toString('base64');
    request({
      method: 'GET',
      uri: `https://api.getrewardful.com/v1/referrals?affiliate_id=${currentUser.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      json: true,
    })
      .then((response) => {
        const visitors = response.data;
        const customers = [];
        for (let i = 0; i < visitors.length; i++) {
          const visitor = visitors[i];
          if (visitor.customer) {
            customers.push(visitor.customer);
          }
        }
        return res.send({
          status: true,
          data: response.data,
          pagination: response.pagination,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          err: err.details[0],
        });
      });
  } else {
    res.status(400).json({
      status: false,
      err: `Can't find affilate id`,
    });
  }
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { paypal } = req.body;
  const auth = Buffer.from(api.REWARDFUL_API_KEY + ':').toString('base64');
  request({
    method: 'POST',
    uri: 'https://api.getrewardful.com/v1/affiliates',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: {
      first_name: currentUser.user_name.split(' ')[0],
      last_name: currentUser.user_name.split(' ')[1] || ' ',
      email: currentUser.email,
      paypal,
    },
    json: true,
  })
    .then((response) => {
      const affiliate = {
        id: response.id,
        link: response.links[0].url,
        paypal,
      };

      currentUser.affiliate = affiliate;
      currentUser.save();

      res.send({
        status: true,
        data: response,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        status: false,
        err: err.details[0],
      });
    });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const { paypal } = req.body;
  if (currentUser.affiliate && currentUser.affiliate.id) {
    const auth = Buffer.from(api.REWARDFUL_API_KEY + ':').toString('base64');
    request({
      method: 'PUT',
      uri: `https://api.getrewardful.com/v1/affiliates/${currentUser.affiliate.id}`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: {
        first_name: currentUser.user_name.split(' ')[0],
        last_name: currentUser.user_name.split(' ')[1] || ' ',
        email: currentUser.email,
        paypal_email: paypal,
      },
      json: true,
    })
      .then((response) => {
        const affiliate = {
          id: response.id,
          link: response.links[0].url,
          paypal,
        };

        currentUser.affiliate = affiliate;
        currentUser.save();

        res.send({
          status: true,
          data: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          err: err.details[0],
        });
      });
  } else {
    res.status(400).json({
      status: false,
      err: `Can't find affilate id`,
    });
  }
};

module.exports = {
  get,
  getAll,
  create,
  update,
};
