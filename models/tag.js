const mongoose = require('mongoose');

const { Schema } = mongoose;
const findOrCreate = require('mongoose-findorcreate');

const TagSchema = new Schema({
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  content: String,
  updated_at: Date,
  created_at: Date,
});
TagSchema.plugin(findOrCreate);
const Tag = mongoose.model('tag', TagSchema);

module.exports = Tag;
