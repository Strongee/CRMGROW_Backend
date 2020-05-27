const mongoose = require("mongoose");

const Label = mongoose.model("label", {
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  name: String,
  color: String,
  font_color: String,
  created_at: Date,
  updated_at: Date,
});

module.exports = Label;
