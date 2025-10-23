// models/knowledgeModel.js
const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeSchema, 'knowledgebase');

module.exports = { KnowledgeBase };