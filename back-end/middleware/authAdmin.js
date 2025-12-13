// middleware/authAdmin.js

const isAdmin = (req, res, next) => {
  if (req.session && req.session.adminId) {
    next();
  } else {
    res.status(401).json({ error: true, message: 'Akses ditolak. Silakan login.' });
  }
};

// --- TAMBAHAN BARU ---
const isSuperAdmin = (req, res, next) => {
  // Cek apakah user login DAN role-nya adalah SUPER_ADMIN
  if (req.session && req.session.adminId && req.session.role === 'SUPER_ADMIN') {
    next();
  } else {
    // Jika bukan Super Admin, tolak dengan 403 (Forbidden)
    res.status(403).json({ error: true, message: 'Akses ditolak. Butuh hak akses Super Admin.' });
  }
};

module.exports = { isAdmin, isSuperAdmin };