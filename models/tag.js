const mongoose = require('mongoose');

const { Schema } = mongoose;
const findOrCreate = require('mongoose-findorcreate');

<<<<<<< HEAD
const TagSchema = new Schema({
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  content: String,
  updated_at: Date,
  created_at: Date,
});
TagSchema.plugin(findOrCreate);
=======
const TagSchema = new Schema(
    {
        user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
        content: String,
        updated_at: Date,
        created_at: Date,
     },
     { 
       timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
     });

 TagSchema.plugin(findOrCreate);
>>>>>>> master
const Tag = mongoose.model('tag', TagSchema);

module.exports = Tag;
