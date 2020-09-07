const mongoose = require('mongoose');

const ContactSchema = mongoose.Schema(
  {
    first_name: String,
    last_name: { type: String, default: '' },
    email: { type: String, default: '' },
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    last_activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    address: String,
    city: String,
    state: String,
    zip: String,
    // label: {
    //   type: String,
    // },
    label: { type: mongoose.Schema.Types.ObjectId, ref: 'label' },
    cell_phone: { type: String, default: '' },
    country: { type: String, default: '' },
    auto_follow_up: { type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' },
    source: String,
    brokerage: String,
    tag: [{ type: mongoose.Schema.Types.ObjectId, ref: 'tag' }],
    tags: Array,
    recruiting_stage: String,
    website: String,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ContactSchema.pre('save', function (next) {
  const contact = this;
  if (this.isNew) {
    if (contact.state) {
      if (States.indexOf(capitalize(contact.state)) === -1) {
        contact.state = '';
      } else {
        contact.state = capitalize(contact.state);
      }
    }
    if (contact.country) {
      if (Countries[contact.country.toUpperCase()]) {
        contact.country = Countries[contact.country.toUpperCase()];
      }
    }
  }
  return next();
});

const Countries = { 'UNITED STATES': 'US', 'UNITED STATE': 'US', CANADA: 'CA' };
const LABEL = [
  '',
  'New',
  'Cold',
  'Team',
  'Warm',
  'Hot',
  'Trash',
  'Appt Set',
  'Appt Missed',
  'Lead',
];
const States = [
  '',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Guam',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Palau',
  'Pennsylvania',
  'Puerto Rico',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Nova Scotia',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
];

const capitalize = (s) => {
  if ((typeof s).toLowerCase() !== 'string') return;
  if (s.split(' ').length === 2) {
    const s1 = s.split(' ')[0];
    const s2 = s.split(' ')[1];
    return `${
      s1.charAt(0).toUpperCase() + s1.slice(1).toLowerCase()
    } ${s2.charAt(0).toUpperCase()}${s2.slice(1).toLowerCase()}`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const Contact = mongoose.model('contact', ContactSchema);
module.exports = Contact;
