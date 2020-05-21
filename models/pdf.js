const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const PDF = mongoose.model('pdf', {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  title: String,
  description: String,
  preview: String,
  type: String,
  url: String,
  role: String,
  del: { type: Boolean, default: false },
  created_at: Date,
  updated_at: Date,
});
=======
const PDFSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: String,
    role: String,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

const PDF = mongoose.model('pdf', PDFSchema);
>>>>>>> master

module.exports = PDF;
