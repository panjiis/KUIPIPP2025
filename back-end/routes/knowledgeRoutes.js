// routes/knowledgeRoutes.js
const express = require("express");
const { isAdmin } = require("../middleware/authAdmin.js");
const { 
  getAllKnowledge, 
  createKnowledge, 
  updateKnowledge, 
  deleteKnowledge 
} = require("../controller/knowledgeController.js");

const knowledgeRouter = express.Router();

// Semua rute ini perlu login admin
knowledgeRouter.use(isAdmin);

knowledgeRouter.get('/', getAllKnowledge);
knowledgeRouter.post('/', createKnowledge);
knowledgeRouter.put('/:id', updateKnowledge);
knowledgeRouter.delete('/:id', deleteKnowledge);

module.exports = knowledgeRouter;