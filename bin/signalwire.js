const { RelayClient } = require('@signalwire/node');

const client = new RelayClient({
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

main().catch(console.error);
