const { RelayClient, RestClient } = require('@signalwire/node');
const request = require('request-promise');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');
const TextHelper = require('../helpers/text');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const client1 = new RelayClient({
  project: '4e0e6aa3-56f5-4f62-9c58-02375d0b67e7',
  token: 'PT6f14a8f00f1faf32b55753484f7e526faa03b822c87f7ad4',
});

async function main() {
  client.on('signalwire.ready', async (client) => {
    const sendResult = await client.messaging.send({
      context: 'office',
      from: '+12242592312',
      to: '+‪13124938446',
      body: 'Welcome at SignalWire!',
    });

    if (sendResult.successful) {
      console.log('Message ID: ', sendResult.messageId);
    }
    console.log('sendResult', sendResult);
  });

  client.connect();
}

const releasePhone = () => {
  const phone_numbers = [
    '2c99fd15-bf54-4cfe-938e-4e1ae6af9e45',
    '1557b0a7-5d67-48fa-a678-090c75ddb108',
    '91080ae2-dadf-42ac-8ee5-8456ff377167',
    '6fb1685b-1581-4d85-bcbc-7377f7e8a902',
    '529bf37e-8ca5-420f-a53f-aee2262a251f',
    '292aeeae-d170-4383-9434-6c798c1ec9f9',
    'a8a5c880-ee22-4fb6-8de8-d555f5ac2125',
    '693fee8a-8c85-489b-b468-fa1d31fccda6',
    '41a42bb1-5248-4667-854a-77790c7cf0c4',
    '58331f70-e06f-4be6-ac10-076fd638d9b9',
    '3865fedd-15f3-4067-8372-f51660bda4c3',
    'a3ff9e3f-1388-4353-839d-e3ece17473b1'
  ];
  for (let i = 0; i < phone_numbers.length; i++) {
    client
      .incomingPhoneNumbers(phone_numbers[i])
      .remove()
      .then(() => console.log(phone_numbers[i]))
      .catch((err) => console.log(err))
      .done();
  }
};

const longNumber = () => {
  client
    .availablePhoneNumbers('US')
    .tollFree.list()
    .then((availablePhoneNumbers) => {
      console.log(availablePhoneNumbers);
    });
};
// main().catch(console.error);

const buyNumber = async () => {
  const number = '+18442631354';
  const proxy_number = await request({
    method: 'POST',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    body: {
      number,
    },
    json: true,
  }).catch((err) => {
    console.log('phone number get err', err);
  });
  console.log('proxy_number', proxy_number);
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sendMessage = async () => {
  const fromNumber = ['+12489634941', '+18442631354'];
  const e164Phone = ['+13124938446', '+13124938446'];
  const content1 = 'Hi, How are you?';
  const content =
    'Hi Super,  Garrett here with Real Estate B-School. I also emailed you but thought I would text you as well. Check out the video below and email me back or text me at 704-610-4888 and let me know if you can make it. -Lars (yes this is really Lars!) Private Confidential Zoom Meeting with Super: https://app.crmgrow.com/video?video=5e2a05c94d04d37842cc8ff9&user=5f5eabe949f8956d8647e050';

  const content2 =
    'Hi Steven, It`s John Rurkowski.Please click and listen to my short video below and text me back at 727-459-7356 so we can set up a time to discuss it. Have a great Saturday. Hello from John Rurkowski: https://app.crmgrow.com/video1/5f6f28f90f0c3a6f7fd57aa9';
  console.log('e164Phone', e164Phone[0]);
  for (let i = 0; i < 10; i++) {
    // await sleep(1000);
    const j = i % 2;
    client.messages
      .create({
        from: fromNumber[0],
        to: e164Phone[0],
        body: `${i} ` + content1,
      })
      .then(async (message) => {
        await sleep(1000);
        console.log('Message ID: ', message.sid);
        console.log('Message status: ', message.status);
        console.info(
          `Send SMS: ${fromNumber[0]} -> ${e164Phone[0]} ${i}:`,
          content1
        );
      })
      .catch((err) => {
        console.log('message send err', err);
      });
  }
};

const receivedStatus = async () => {
  // const message_sid = '37153dcc-8ab2-4915-aad0-8e576d6a33d5';
  const message_sid = '9b668948-0f96-449a-a9e2-5df6ecc7aab6';

  TextHelper.getStatus(message_sid).then((res) => {
    console.log('res', res);
  });
};

const getSignalWireNumber = async (id) => {
  // const user = await User.findOne({ _id: id }).catch((err) => {
  //   console.log('err', err);
  // });
  let areaCode = '818';
  let countryCode = 'CA';
  let fromNumber;

  const response = await request({
    method: 'GET',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers/search`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    qs: {
      areacode: areaCode,
    },
    json: true,
  }).catch((err) => {
    console.log('phone number get err', err);
    fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
    return fromNumber;
  });

  if (fromNumber) {
    return fromNumber;
  }

  const number = response.data[0];
  console.log('number', number);
  /**
  if (number) {
    const proxy_number = await request({
      method: 'POST',
      uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers`,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        user: api.SIGNALWIRE.PROJECT_ID,
        password: api.SIGNALWIRE.TOKEN,
      },
      body: {
        number: number.e164,
      },
      json: true,
    }).catch((err) => {
      console.log('phone number get err', err);
      fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
      return fromNumber;
    });
  }
   */
};

// longNumber();
// buyNumber();
// sendMessage();
// releasePhone();
// receivedStatus();
getSignalWireNumber();
