// controller/knowledgeController.js
const { KnowledgeBase } = require('../models/knowledgeModel');

// GET /api/knowledge
exports.getAllKnowledge = async (req, res) => {
  try {
    const allData = await KnowledgeBase.find({}).sort({ updatedAt: -1 });
    res.status(200).json({ error: false, data: allData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// POST /api/knowledge
exports.createKnowledge = async (req, res) => {
  try {
    const { topic, content } = req.body;
    if (!topic || !content) {
      return res.status(400).json({ error: true, message: 'Topik dan Konten diperlukan' });
    }
    const status  = "ACTIVE";
    const newData = new KnowledgeBase({ topic, content, status:status});
    await newData.save();
    res.status(201).json({ error: false, message: 'Data berhasil dibuat', data: newData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// PUT /api/knowledge/:id
exports.updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, content } = req.body;
    
    const updatedData = await KnowledgeBase.findByIdAndUpdate(
      id, 
      { topic, content }, 
      { new: true, runValidators: true } // 'new: true' agar mengembalikan dokumen yg sdh diupdate
    );
    
    if (!updatedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }
    res.status(200).json({ error: false, message: 'Data berhasil diupdate', data: updatedData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// PUT /api/knowledge/:id
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updatedData = await KnowledgeBase.findByIdAndUpdate(
      id, 
      { status:status}, 
      { new: true, runValidators: true } // 'new: true' agar mengembalikan dokumen yg sdh diupdate
    );
    
    if (!updatedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }
    res.status(200).json({ error: false, message: 'Data berhasil diupdate', data: updatedData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};



// DELETE /api/knowledge/:id
exports.deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedData = await KnowledgeBase.findByIdAndDelete(id);
    
    if (!deletedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }
    res.status(200).json({ error: false, message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};
