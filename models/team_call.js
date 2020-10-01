const mongoose = require('mongoose');

const { Schema } = mongoose;
const findOrCreate = require('mongoose-findorcreate');

const TeamCallSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    invite: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    description: String,
    status: { type: String, default: 'pending' },
    due_date: Date,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const TeamCall = mongoose.model('team_call', TeamCallSchema);

module.exports = TeamCall;
