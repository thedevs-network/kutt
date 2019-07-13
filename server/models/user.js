const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  apikey: { type: String, unique: true },
  banned: { type: Boolean, default: false },
  cooldowns: [Date],
  createdAt: { type: Date, required: true, default: Date.now },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true },
  resetPasswordExpires: { type: Date },
  resetPasswordToken: { type: String },
  verificationExpires: { type: Date },
  verificationToken: { type: String },
  verified: { type: Boolean, required: true, default: false },
  // TODO: domains
});

module.exports = mongoose.model('user', UserSchema);
