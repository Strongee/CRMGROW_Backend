const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TimeLineSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    status: String,
    due_date: Date,
    period: Number,
    action: Object,
    ref: String,
    parent_ref: String,
    automation: { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    condition: {
      case: String,
      answer: Boolean,
    },
    watched_video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    watched_pdf: { type: mongoose.Schema.Types.ObjectId, ref: 'pdf' },
    watched_image: { type: mongoose.Schema.Types.ObjectId, ref: 'image' },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const TimeLine = mongoose.model('time_line', TimeLineSchema);

module.exports = TimeLine;
