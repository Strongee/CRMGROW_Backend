const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Image = mongoose.model('image', {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  title: String,
  description: String,
  preview: String,
  type: String,
  url: Array,
  role: String,
  del: { type: Boolean, default: false },
  created_at: Date,
  updated_at: Date,
});
=======
const ImageSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: Array,
    role: String,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Image = mongoose.model('image', ImageSchema);
>>>>>>> master

module.exports = Image;
