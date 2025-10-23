// models/knowledgeModel.js
const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  content: { type: String, required: true },
  // UBAH BARIS INI
  status: { 
    type: String, 
    required: true, 
    default: 'ACTIVE' 
  }
}, { timestamps: true });

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeSchema, 'knowledgebase');

module.exports = { KnowledgeBase };