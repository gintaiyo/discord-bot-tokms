const mongoose = require('mongoose');

const NameSchema = new mongoose.Schema({
  // name: { type: datatyep, required: boolean, default: boolean },
});

module.exports = mongoose.model("name", NameSchema);
