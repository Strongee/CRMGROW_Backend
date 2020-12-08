const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PDFSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: String,
    role: String,
    default_edited: { type: Boolean, default: false },
    default_pdf: { type: mongoose.Schema.Types.ObjectId, ref: 'pdf' },
    has_parent: { type: Boolean, default: false },
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const PDF = mongoose.model('pdf', PDFSchema);

module.exports = PDF;
