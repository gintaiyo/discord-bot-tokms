const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  guildId: { type: String, required: true},
  userId: { type: String, required: true},
  caseId: { type: Number, required: true},
  type: { type: String, required: true},
  reason: { type: String, required: true},
  moderatorId: { type: String, required: true},
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Cases || mongoose.model("Case", caseSchema, "cases");
