const Note = require('../models/note');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const api = require('../config/api');

const request = require('request-promise');

const get = async (req, res) => {
  const { currentUser } = req;
  const query = { ...req.query };
  const contact = query['contact'];

  const data = await Note.find({ user: currentUser.id, contact });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
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
      last_name: currentUser.user_name.split(' ')[1],
      email: currentUser.email,
      paypal,
    },
    json: true,
  })
    .then((response) => {
      console.log('response', response);
      const affiliate = {
        id: response.id,
        link: response.links[0].url,
        paypal,
      };

      currentUser.affiliate = affiliate;
      currentUser.save();

      res.send({
        status: true,
      });
    })
    .catch((err) => {
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
        last_name: currentUser.user_name.split(' ')[1],
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
          data: response.links[0].url,
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
