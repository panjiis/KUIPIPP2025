// routes/knowledgeRoutes.js
const express = require("express");
const { isAdmin } = require("../middleware/authAdmin.js");
const { 
  getAllKnowledge, 
  createKnowledge, 
  updateKnowledge, 
  deleteKnowledge,
  toggleKnowledgeStatus,
  getCategories,
  getKnowledgeStructure // Pastikan diimpor
} = require("../controller/knowledgeController.js");

const knowledgeRouter = express.Router();

// ==========================================
// 1. RUTE PUBLIK (Tanpa Login)
// ==========================================
// Letakkan di ATAS 'isAdmin' agar Chatbot & Admin bisa akses tanpa cookie auth
knowledgeRouter.get('/categories', getCategories); 
knowledgeRouter.get('/structure', getKnowledgeStructure);


// ==========================================
// 2. MIDDLEWARE AUTH (Gembok Admin)
// ==========================================
// Semua rute di bawah baris ini WAJIB Login sebagai Admin
knowledgeRouter.use(isAdmin);

// --- Rute Admin ---
knowledgeRouter.get('/', getAllKnowledge);
knowledgeRouter.post('/', createKnowledge);
knowledgeRouter.put('/:id/status', toggleKnowledgeStatus);
knowledgeRouter.put('/:id', updateKnowledge);
knowledgeRouter.delete('/:id', deleteKnowledge);

module.exports = knowledgeRouter;