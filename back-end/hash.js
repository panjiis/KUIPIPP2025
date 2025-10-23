// buatHash.js
const bcrypt = require('bcrypt');
const password = 'admin123'; // <-- GANTI DENGAN PASSWORD YANG ANDA INGINKAN

const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error("Gagal membuat hash:", err);
        return;
    }
    console.log("Hash Password Anda (salin ini):");
    console.log(hash);
});