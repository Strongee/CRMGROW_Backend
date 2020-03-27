const mongoose = require('mongoose');

const Page = mongoose.model('page', {
    slug: String,
    title: String,
    html: String,
    style: String,
    meta: {
        type: {
            title: String,
            description: String,
            image: String
        }
    },
    default: Boolean,
    user: String,
    home: { type: Boolean, default: false},  
    status: { type: Boolean, default: false}
 });

 module.exports = Page