const mongoose = require('mongoose');

const IpSchema = new mongoose.Schema({
  ip: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ip', IpSchema);
