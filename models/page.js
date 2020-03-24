const mongoose = require('mongoose');

const Page = mongoose.model('page', {
    slug: String,
    title: String,
    html: String,
    css: String,
    meta: String,
    default: String,
    user: String,
    path: String
 });

 module.exports = Page