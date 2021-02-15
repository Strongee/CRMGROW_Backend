const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const AppointmentSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    location: String,
    due_start: Date,
    due_end: Date,
    type: Number,
    del: { type: Boolean, default: false },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    guests: Array,
    event_id: String,
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    shared_appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'appointment',
    },
    has_shared: Boolean,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

AppointmentSchema.index({ event_id: 1 });
const Appointment = mongoose.model('appointment', AppointmentSchema);

module.exports = Appointment;
