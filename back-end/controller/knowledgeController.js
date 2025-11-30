// controller/knowledgeController.js
const { KnowledgeBase } = require('../models/knowledgeModel');

// --- FUNGSI HELPER (Update Otomatis Daftar Kategori) ---
// Fungsi ini akan dijalankan setiap kali ada Create/Update/Delete
const refreshCategorySummary = async () => {
  try {
    // 1. Ambil semua data yang AKTIF, KECUALI dokumen "daftar kategori chatbot" itu sendiri
    //    agar tidak terjadi rekursif (data masuk ke dalam dirinya sendiri).
    const allData = await KnowledgeBase.find({ 
      status: 'ACTIVE',
      topic: { $ne: 'daftar kategori chatbot' } 
    }).sort({ category: 1, topic: 1 });

    // 2. Kelompokkan data berdasarkan Category
    const groupedData = {};
    allData.forEach(item => {
      // Gunakan kategori default jika kosong
      const cat = item.category || 'Uncategorized';
      
      if (!groupedData[cat]) {
        groupedData[cat] = [];
      }
      groupedData[cat].push(item.topic);
    });

    // 3. Susun String sesuai format yang diminta
    // Format:
    // Category A
    // - Topic A
    // - Topic B
    let summaryContent = "Berikut adalah daftar kategori dan topik yang tersedia dalam pengetahuan chatbot:\n\n";
    
    for (const [category, topics] of Object.entries(groupedData)) {
      summaryContent += `${category}\n`;
      topics.forEach(topic => {
        summaryContent += `- ${topic}\n`;
      });
      summaryContent += "\n"; // Spasi antar kategori
    }

    // 4. Update atau Buat (Upsert) dokumen "daftar kategori chatbot"
    await KnowledgeBase.findOneAndUpdate(
      { topic: 'daftar kategori chatbot' }, // Cari berdasarkan topik ini
      { 
        topic: 'daftar kategori chatbot',
        content: summaryContent,
        category: 'System', // Kita beri kategori khusus agar rapi
        status: 'ACTIVE'
      },
      { upsert: true, new: true } // Buat baru jika belum ada
    );

    console.log("✓ Daftar kategori chatbot berhasil diperbarui otomatis.");

  } catch (error) {
    console.error("Gagal memperbarui daftar kategori:", error.message);
    // Kita tidak melempar error ke res, cukup log di console agar tidak mengganggu flow utama
  }
};

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
    const { topic, content, category } = req.body;
    if (!topic || !content || !category) {
      return res.status(400).json({ error: true, message: 'Topik, Konten, dan Kategori diperlukan' });
    }

    const newData = new KnowledgeBase({ topic, content, category });
    await newData.save();

    // --- TRIGGER UPDATE DAFTAR ---
    await refreshCategorySummary(); 

    res.status(201).json({ error: false, message: 'Data berhasil dibuat', data: newData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// PUT /api/knowledge/:id
exports.updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, content, category } = req.body;
    
    const updatedData = await KnowledgeBase.findByIdAndUpdate(
      id, 
      { topic, content, category },
      { new: true, runValidators: true }
    );
    
    if (!updatedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }

    // --- TRIGGER UPDATE DAFTAR ---
    await refreshCategorySummary();

    res.status(200).json({ error: false, message: 'Data berhasil diupdate', data: updatedData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// Toggle Status
exports.toggleKnowledgeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const knowledgeItem = await KnowledgeBase.findById(id);

    if (!knowledgeItem) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }

    const newStatus = knowledgeItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedItem = await KnowledgeBase.findByIdAndUpdate(
      id,
      { status: newStatus },
      { new: true }
    );

    // --- TRIGGER UPDATE DAFTAR ---
    // (Penting karena item INACTIVE tidak akan masuk daftar)
    await refreshCategorySummary();

    res.status(200).json({ 
      error: false, 
      message: `Status berhasil diubah menjadi ${newStatus}`, 
      data: updatedItem 
    });

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

    // --- TRIGGER UPDATE DAFTAR ---
    await refreshCategorySummary();

    res.status(200).json({ error: false, message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};