const mongoose = require('mongoose');

const ContactSchema = mongoose.Schema({
    first_name: String,
    last_name: { type: String, default: '' },
    email: { type: String, default: '' },
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    last_activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    address: String,
    city: String,
    state: String,
    zip: String,
    label: { 
        type: String
    },
    cell_phone: { type: String, default: '' },
    country: { type: String, default: '' },
    source: String,
    brokerage: String,
    tag: [{ type: mongoose.Schema.Types.ObjectId, ref: 'tag' }],
    tags: Array,
    recruiting_stage: String,
    created_at: Date,
    updated_at: Date,
})

ContactSchema.pre('save', function(next) {
    var contact = this;
    if(this.isNew) {
        if(Labels.indexOf(capitalize(contact.label)) === -1) {
            contact.label = ''
        }
        else {
            contact.label = capitalize(contact.label);
        }
    }
    return next();
})

const Labels = ['','New','Cold','Team','Warm','Hot','Trash'];

const capitalize = (s) => {
    if ((typeof s).toLowerCase() !== 'string') return;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const Contact = mongoose.model('contact', ContactSchema);
module.exports = Contact