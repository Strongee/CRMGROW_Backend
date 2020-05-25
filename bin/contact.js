const mongoose = require('mongoose');
const User = require('../models/user');
const Contact = require('../models/contact');
const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));
// Fetch or read data from
const migrate = async () => {
  const user = await User.findOne({
    email: 'brent.wallgren@exprealty.com',
  }).catch((err) => {
    console.log('err', err);
  });

  const contacts = await Contact.find({ user: user.id }).catch((err) => {
    console.log('err', err);
  });

  if (contacts) {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const user_name = contact.first_name;
      if (user_name) {
        console.log('user_name', user_name);
        contact['first_name'] = user_name.split(' ')[0];
        contact['last_name'] = user_name.split(' ')[1];
        contact.save().catch((err) => {
          console.log('err', err);
        });
      }
    }
  }
};
migrate();
