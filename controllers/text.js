const phone = require('phone');
const mongoose = require('mongoose');

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Text = require('../models/text');
const Note = require('../models/note');
const urls = require('../constants/urls');
const api = require('../config/api');
const TextHelper = require('../helpers/text');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const getAll = async (req, res) => {
  const { currentUser } = req;
  const texts = await Text.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(currentUser._id),
      },
    },
    {
      $group: {
        _id: '$contacts',
        data: { $push: '$$ROOT' },
      },
    },
    {
      $lookup: {
        from: 'contacts',
        localField: '_id',
        foreignField: '_id',
        as: 'contact_detail',
      },
    },
  ]);

  return res.send({
    status: true,
    data: texts,
  });
};

const send = async (req, res) => {
  const { currentUser } = req;
  const { text } = req.body;
  const contact = await Contact.findOne({ _id: req.params.id }).catch((err) => {
    console.log('err', err);
  });
  const e164Phone = phone(contact.cell_phone)[0];
  let fromNumber = currentUser['proxy_number'];

  if (!fromNumber) {
    const areaCode = currentUser.cell_phone.substring(1, 4);
    const data = await twilio.availablePhoneNumbers('US').local.list({
      areaCode,
    });

    const number = data[0];
    const proxy_number = await twilio.incomingPhoneNumbers.create({
      phoneNumber: number.phoneNumber,
      smsUrl: urls.SMS_RECEIVE_URL,
    });
    currentUser['proxy_number'] = proxy_number.phoneNumber;
    fromNumber = currentUser['proxy_number'];
    currentUser.save().catch((err) => {
      console.log('err', err);
    });
  }

  console.info(`Send SMS: ${fromNumber} -> ${contact.cell_phone} :`, text);

  if (!e164Phone) {
    return res.status(400).send({
      status: false,
      error: 'Invalid phone number',
    });
  }

  await twilio.messages
    .create({ from: fromNumber, body: text, to: e164Phone })
    .catch((err) => {
      console.log('err', err);
    });

  const new_text = new Text({
    content: req.body.text,
    contact: req.params.id,
    to: e164Phone,
    from: fromNumber,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  new_text
    .save()
    .then((_sms) => {
      const activity = new Activity({
        content: currentUser.user_name + ' sent text',
        contacts: _sms.contact,
        user: currentUser.id,
        type: 'texts',
        text: _sms.id,
      });

      activity.save().then((_activity) => {
        const myJSON = JSON.stringify(_sms);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((e) => {
      let errors;
      if (e.errors) {
        errors = e.errors.map((err) => {
          delete err.instance;
          return err;
        });
      }
      return res.status(500).send({
        status: false,
        error: errors || e,
      });
    });
};

const receive = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ twilio_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    // let phoneNumberString
    // if(currentUser.phone) {
    //   const userPhone = currentUser.phone
    //   phoneNumberString = userPhone.internationalNumber
    // } else {
    //   phoneNumberString = TextHelper.matchUSPhoneNumber(currentUser.cell_phone)
    // }

    // if (!e164Phone) {
    //   const error = {
    //     error: 'Invalid Phone Number'
    //   }

    //   throw error // Invalid phone number
    // }

    if (contact) {
      const content =
        contact.first_name +
        ', please call/text ' +
        currentUser.user_name +
        ' back at: ' +
        currentUser.cell_phone;
      await twilio.messages
        .create({ from: to, body: content, to: from })
        .catch((err) => {
          console.log('sms reply err', err);
        });
    }

    // const sms = new SMS({
    //   content: text,
    //   contact: contact.id,
    //   to: currentUser.cell_phone,
    //   from: from,
    //   user: currentUser.id,
    //   updated_at: new Date(),
    //   created_at: new Date(),
    // })

    // const _sms = await sms.save()

    // const activity = new Activity({
    //   content: contact.first_name + ' replied text',
    //   contacts: contact.id,
    //   user: currentUser.id,
    //   type: 'sms',
    //   sms: _sms.id,
    //   created_at: new Date(),
    //   updated_at: new Date(),
    // })

    // activity.save()
  }
  return res.send({
    status: true,
  });
};

const receive1 = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ proxy_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'sms_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      } else {
        const content =
          contact.first_name +
          ', please call/text ' +
          currentUser.user_name +
          ' back at: ' +
          currentUser.cell_phone;

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      }
    }
  }
  return res.send({
    status: true,
  });
};

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

const receiveTextSignalWire = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ proxy_number: to }).catch((err) => {
    console.log('current user found err text', err.message);
  });

  if (currentUser) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'text_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      } else {
        const new_text = new Text({
          user: currentUser.id,
          contact: contact.id,
          content: text,
          type: 1,
        });

        new_text.save().catch((err) => {
          console.log('new text save err', err.message);
        });

        const activity = new Activity({
          content: 'received text',
          contacts: contact.id,
          user: currentUser.id,
          type: 'texts',
          texts: text.id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      }
    } else {
      const content =
        'Please call/text ' +
        currentUser.user_name +
        'back at: ' +
        currentUser.cell_phone;

      await client.messages
        .create({
          from: to,
          to: from,
          body: content,
        })
        .catch((err) => {
          console.log('sms reply err', err);
        });
    }
  }
  return res.send();
};

const receiveTextTwilio = async (req, res) => {
  const text = req.body['Body'];
  const from = req.body['From'];
  const to = req.body['To'];

  const currentUser = await User.findOne({ proxy_number: to }).catch((err) => {
    console.log('current user found err sms', err.message);
  });

  if (currentUser != null) {
    const phoneNumber = req.body['From'];

    const contact = await Contact.findOne({
      cell_phone: phoneNumber,
      user: currentUser.id,
    }).catch((err) => {
      console.log('contact found err sms reply', err);
    });

    if (contact) {
      if (text.toLowerCase() === 'stop') {
        const activity = new Activity({
          content: 'unsubscribed sms',
          contacts: contact.id,
          user: currentUser.id,
          type: 'text_trackers',
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
        const content =
          'You have successfully been unsubscribed. You will not receive any more messages from this number.';

        await client.messages
          .create({
            from: to,
            to: from,
            body: content,
          })
          .catch((err) => {
            console.log('sms reply err', err);
          });
      } else {
        const new_text = new Text({
          user: currentUser.id,
          contact: contact.id,
          content: text,
          type: 1,
        });

        new_text.save().catch((err) => {
          console.log('new text save err', err.message);
        });

        const activity = new Activity({
          content: 'received text',
          contacts: contact.id,
          user: currentUser.id,
          type: 'texts',
          texts: text.id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });

        Contact.updateOne(
          { _id: contact.id },
          {
            $set: { last_activity: activity.id },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      }
    } else {
      const content =
        'Please call/text ' +
        currentUser.user_name +
        ' back at: ' +
        currentUser.cell_phone;

      await twilio.messages
        .create({ from: to, body: content, to: from })
        .catch((err) => {
          console.log('sms reply err', err);
        });
    }
  }
  return res.send();
};

const buyNumbers = async (req, res) => {
  const { currentUser } = req;
  let areaCode;
  let countryCode;
  const data = [];
  const phone = currentUser.phone;
  if (phone) {
    areaCode = phone.areaCode;
    countryCode = phone.countryCode;
  } else {
    areaCode = currentUser.cell_phone.substring(1, 4);
    countryCode = 'US';
  }

  const search_code = req.body.searchCode || areaCode;

  if (countryCode === 'US' || countryCode === 'CA') {
    client
      .availablePhoneNumbers(countryCode)
      .local.list({
        AreaCode: search_code,
      })
      .then(async (available_phone_numbers) => {
        if (available_phone_numbers && available_phone_numbers.length > 0) {
          available_phone_numbers.forEach((number) => {
            data.push({
              number: number.phoneNumber,
              service: 'signalwire',
            });
          });
          return res.send({
            status: true,
            data,
          });
        } else {
          /**
           * twilio numbers search
           *  */
          twilio
            .availablePhoneNumbers(countryCode)
            .local.list({
              areaCode: search_code,
            })
            .then((response) => {
              const number = response[0];
              if (typeof number === 'undefined' || number === '+') {
                return res.status(400).json({
                  status: false,
                  error: 'Numbers not found',
                });
              } else {
                response.forEach((number) => {
                  data.push({
                    number: number.phoneNumber,
                    service: 'twilio',
                  });
                });
                return res.send({
                  status: true,
                  data,
                });
              }
            })
            .catch((err) => {
              return res.status(500).json({
                status: false,
                error: err.message || err,
              });
            });
        }
      })
      .catch((err) => {
        console.log('phone number get err', err);
      });
  } else {
    twilio
      .availablePhoneNumbers(countryCode)
      .local.list({
        areaCode,
      })
      .then(async (response) => {
        const number = data[0];

        if (typeof number === 'undefined' || number === '+') {
          return res.status(400).json({
            status: false,
            error: 'Numbers not found',
          });
        } else {
          response.forEach((number) => {
            data.push({
              number: number.phoneNumber,
              service: 'twilio',
            });
          });
          return res.send({
            status: true,
            data,
          });
        }
      })
      .catch((err) => {
        return res.status(500).json({
          status: false,
          error: err.message || err,
        });
      });
  }
};

module.exports = {
  get,
  getAll,
  send,
  receive,
  receive1,
  buyNumbers,
  receiveTextSignalWire,
  receiveTextTwilio,
};
