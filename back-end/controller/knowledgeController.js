// controller/knowledgeController.js
const { KnowledgeBase } = require('../models/knowledgeModel');
const { Category } = require('../models/categoryModel');

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

const updateCategoryStats = async (categoryName, changeTotal, changeActive) => {
  if (!categoryName) return;

  try {
    const updatedCat = await Category.findOneAndUpdate(
      { name: categoryName },
      { 
        $inc: { 
          topicCount: changeTotal, 
          activeTopicCount: changeActive 
        } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // LOGIKA HAPUS KATEGORI JIKA KOSONG
    // Jika jumlah topik 0 (atau kurang, untuk jaga-jaga), hapus kategori
    if (updatedCat.topicCount <= 0) {
      await Category.findByIdAndDelete(updatedCat._id);
      console.log(`🗑️ Kategori "${categoryName}" dihapus karena kosong.`);
    }
  } catch (error) {
    console.error(`Gagal update stats kategori ${categoryName}:`, error);
  }
};


// GET /api/knowledge (Tetap sama)
exports.getAllKnowledge = async (req, res) => {
  try {
    const allData = await KnowledgeBase.find({}).sort({ updatedAt: -1 });
    res.status(200).json({ error: false, data: allData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// --- API BARU: GET Categories ---
// Dipanggil oleh Frontend untuk menampilkan menu/dropdown
exports.getCategories = async (req, res) => {
  try {
    // Hanya ambil yang activeTopicCount > 0 jika untuk user chatbot
    // Atau ambil semua jika untuk Admin panel
    const categories = await Category.find({}).sort({ name: 1 });
    res.status(200).json({ error: false, data: categories });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// POST /api/knowledge
exports.createKnowledge = async (req, res) => {
  try {
    const { topic, content, category } = req.body;
    
    // 1. Buat Knowledge Baru (Default Status: ACTIVE)
    const newData = new KnowledgeBase({ 
      topic, 
      content, 
      category,
      status: 'ACTIVE',
      is_sync: false 
    });
    await newData.save();

    // 2. UPDATE CATEGORY: Tambah Total (+1) dan Active (+1)
    await updateCategoryStats(category, 1, 1);

    res.status(201).json({ error: false, message: 'Data berhasil dibuat', data: newData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// PUT /api/knowledge/:id
exports.updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, content, category } = req.body; // Kategori baru (jika diedit)
    
    // Ambil data lama sebelum diupdate untuk perbandingan
    const oldData = await KnowledgeBase.findById(id);
    if (!oldData) return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });

    const oldCategory = oldData.category;
    const isActive = oldData.status === 'ACTIVE';

    // Update Knowledge
    const updatedData = await KnowledgeBase.findByIdAndUpdate(
      id, 
      { topic, content, category, is_sync: false },
      { new: true, runValidators: true }
    );

    // 3. CEK PERUBAHAN KATEGORI
    if (oldCategory !== category) {
      // a. Kurangi dari kategori LAMA
      // Jika statusnya active, kurangi active count juga
      await updateCategoryStats(oldCategory, -1, isActive ? -1 : 0);

      // b. Tambah ke kategori BARU
      await updateCategoryStats(category, 1, isActive ? 1 : 0);
    }

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
    if (!knowledgeItem) return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });

    const oldStatus = knowledgeItem.status;
    const newStatus = oldStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // Update Status
    const updatedItem = await KnowledgeBase.findByIdAndUpdate(
      id,
      { status: newStatus, is_sync: false },
      { new: true }
    );

    // 4. UPDATE CATEGORY (Hanya Active Count yang berubah)
    if (newStatus === 'ACTIVE') {
      // Inactive -> Active: Tambah 1 ke active count
      await updateCategoryStats(knowledgeItem.category, 0, 1);
    } else {
      // Active -> Inactive: Kurangi 1 dari active count
      await updateCategoryStats(knowledgeItem.category, 0, -1);
    }

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

    // 5. UPDATE CATEGORY: Kurangi Total (-1) dan Active (jika tadi active)
    const wasActive = deletedData.status === 'ACTIVE';
    await updateCategoryStats(
      deletedData.category, 
      -1, 
      wasActive ? -1 : 0
    );

    res.status(200).json({ error: false, message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

exports.getKnowledgeStructure = async (req, res) => {
  try {
    const structure = await KnowledgeBase.aggregate([
      // 1. Hanya ambil yang ACTIVE
      { $match: { status: 'ACTIVE', is_sync: true } },
      // 2. Kelompokkan berdasarkan Category
      {
        $group: {
          _id: "$category", // Nama Kategori
          topics: { $push: "$topic" } // Kumpulkan topik ke dalam array
        }
      },
      // 3. Sortir kategori sesuai abjad (A-Z)
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({ error: false, data: structure });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};