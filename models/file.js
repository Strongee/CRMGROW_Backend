const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const File = mongoose.model('file', {
  name: String,
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  type: String,
  created_at: Date,
  updated_at: Date,
});
=======
const FileSchema = new Schema({
    name: String,
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    type: String,
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const File = mongoose.model('file', FileSchema);
>>>>>>> master

module.exports = File;
