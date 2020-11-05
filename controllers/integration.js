const Garbage = require('../models/garbage');
const request = require('request-promise');
const nodemailer = require('nodemailer');

const checkAuthCalendly = async (req, res) => {
  const { token } = req.body;
  const { currentUser } = req;
  request({
    method: 'GET',
    uri: `https://calendly.com/api/v1/echo`,
    headers: {
      'Content-Type': 'application/json',
      'X-TOKEN': token,
    },
    json: true,
  })
    .then((response) => {
      const calendly = {
        token,
        email: response.email,
      };

      Garbage.updateOne({ user: currentUser.id }, { $set: { calendly } }).catch(
        (err) => {
          console.log('garbage update error', err.message);
        }
      );

      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: 'UnAuthorized',
      });
    });
};

const getCalendly = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('garbage found err');
    }
  );

  const { calendly } = garbage;

  if (calendly && calendly.token) {
    request({
      method: 'GET',
      uri: `https://calendly.com/api/v1/users/me/event_types`,
      headers: {
        'Content-Type': 'application/json',
        'X-TOKEN': calendly.token,
      },
      json: true,
    })
      .then((response) => {
        return res.send({
          status: true,
          data: response.data,
        });
      })
      .catch((err) => {
        return res.status(400).json({
          status: false,
          error: 'UnAuthorized',
        });
      });
  } else {
    return res.status(400).json({
      status: false,
      error: 'Please connect Calendly first',
    });
  }
};

const setEventCalendly = async (req, res) => {
  const { currentUser } = req;
  Garbage.updateOne(
    {
      user: currentUser.id,
    },
    {
      $set: {
        'calendly.id': req.body.id,
        'calendly.link': req.body.link + '?embed_type=Inline',
      },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('garbage update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

const connectSMTP = async (req, res) => {
  const { currentUser } = req;
  const { host_name, port, email, user_name, password, secure } = req.body;
  const mailOptions = {
    from: `${currentUser.user_name} <${email}>`,
    to: 'amazingskill8001@gmail.com',
    subject: 'test again',
    text: 'Test',
    html: '<p>Test</p>',
  };

  console.log('yahoo.....', currentUser.yahoo_refresh_token);
  const transporter = nodemailer.createTransport({
    host: `smtp.${host_name}`,
    port: port || 587,
    secureConnection: secure || port === 465,
    auth: {
      user: user_name,
      pass: password,
    },
  });
  transporter.sendMail(mailOptions, (err, data) => {
    if (err) {
      return console.log(err);
    } else {
      console.log(JSON.stringify(data));
      res.send({
        status: true,
      });
    }
  });
};

module.exports = {
  checkAuthCalendly,
  setEventCalendly,
  getCalendly,
  connectSMTP,
};
