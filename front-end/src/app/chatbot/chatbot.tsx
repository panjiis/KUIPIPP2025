'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';

const initialMessages = [
  { sender: 'bot', text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus?' },
];

export default function Chatbot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // --- (BARU) LANGKAH 1: Tambahkan State untuk Modal dan Persetujuan ---
  const [showConsentModal, setShowConsentModal] = useState(false);
  // Tipe state: null (belum memilih), 'true' (setuju), 'false' (tidak setuju)
  const [userConsent, setUserConsent] = useState<string | null>(null);


  // PERUBAHAN 1: Membuat sesi chat baru secara otomatis
  useEffect(() => {
    // ... (Fungsi createNewChatSession tetap sama)
    const createNewChatSession = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/create-chat', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          console.log('Sesi chat berhasil dibuat atau diperbarui.');
        } else {
          throw new Error('Gagal membuat sesi chat');
        }
      } catch (error) {
        console.error('Error saat membuat sesi chat:', error);
        setMessages((prev) => [
          ...prev,
          { sender: 'bot', text: '⚠️ Gagal terhubung ke server. Silakan muat ulang halaman.' },
        ]);
      }
    };
    createNewChatSession();

    // --- (BARU) LANGKAH 2: Cek localStorage saat Komponen Dimuat ---
    const storedConsent = localStorage.getItem('chatConsent');
    if (storedConsent) {
      // Jika sudah ada, atur state sesuai pilihan sebelumnya
    setShowConsentModal(true);
    } else {
      // Jika belum ada, tampilkan modal persetujuan
      setUserConsent(null);
    }
  }, []); // Tetap [] agar hanya berjalan sekali saat mount

  // --- (BARU) LANGKAH 4: Buat Fungsi handleConsent ---
const handleConsent = (hasAgreed: boolean) => {
  const consentValue = hasAgreed ? 'true' : 'false';

  // Langsung perbarui state saja
  setUserConsent(consentValue);
  // Tutup modal
  setShowConsentModal(false);
  const postConsent = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/consent', {
          method: 'POST',
          // 2. Tambahkan headers untuk memberitahu server bahwa Anda mengirim JSON
          headers: {
            'Content-Type': 'application/json',
          },
          // 3. Tambahkan body yang berisi data Anda
          //    Gunakan JSON.stringify untuk mengubah objek JavaScript menjadi string JSON
          body: JSON.stringify({ consent: consentValue }), 
          credentials: 'include',
        });
        if (res.ok) {
          console.log('Sesi chat berhasil dibuat atau diperbarui.');
        } else {
          throw new Error('Gagal membuat sesi chat');
        }
      } catch (error) {
        console.error('Error saat membuat sesi chat:', error);
        
      }
    }
    postConsent();

  if (!hasAgreed) {
    console.warn("Pengguna tidak setuju. History chat tidak akan disimpan.");
    setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: 'Baik, history chat untuk sesi ini tidak akan disimpan.' },
    ]);
  }
};


  // PERUBAHAN 2: Fungsi pengiriman diubah
  // --- (MODIFIKASI) LANGKAH 6: Terima `canSaveHistory` sebagai parameter ---
  const sendMessageToServer = async (userMsg: string, canSaveHistory: boolean) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            msg: userMsg,
            saveHistory: canSaveHistory 
        }),
      });

      if (!res.ok) {
        // ... (sisa logika error tetap sama)
        const errorData = await res.json();
        if (errorData.refresh) {
          window.location.reload(); 
        }
        throw new Error(errorData.message || 'Server error');
      }

      const data = await res.json();
      return data.reply || 'Maaf, saya tidak dapat menemukan jawaban.';
    } catch (error) {
      console.error('Error fetching from Node.js backend:', error);
      // ... (sisa logika error tetap sama)
      if (error instanceof Error) {
        return `⚠️ Gagal terhubung: ${error.message}`;
      }
      return '⚠️ Gagal terhubung ke server. Pastikan semua server berjalan.';
    } finally {
      setLoading(false);
    }
  };

  // --- (MODIFIKASI) LANGKAH 5: Modifikasi Logika Pengiriman Chat ---
  const handleSend = async () => {
    if (!input.trim() || showConsentModal) return; // Jangan kirim jika modal masih aktif

    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    // Dapatkan status persetujuan terbaru dari state
    const canSaveHistory = userConsent === 'true';

    // Panggil fungsi yang sudah diubah dengan parameter baru
    const botResponse = await sendMessageToServer(userMsg, canSaveHistory);
    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // (Sisa kode JSX tidak berubah)
  return (
    <section className="min-h-screen flex items-center justify-center bg-gray-900 p-4 font-sans relative">
      
      {/* --- (BARU) LANGKAH 3: Buat Komponen Modal --- */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 p-6 rounded-lg shadow-lg max-w-sm w-full text-center border border-neutral-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Persetujuan History Chat
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              Apakah Anda mengizinkan kami menyimpan history chat dan dilihat oleh admin untuk peningkatan kualitas layanan?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleConsent(false)}
                className="px-4 py-2 rounded-lg bg-neutral-600 hover:bg-neutral-500 text-white font-medium transition-colors"
              >
                Tidak Setuju
              </button>
              <button
                onClick={() => handleConsent(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Setuju
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konten Chatbot Utama */}
      <div className="w-full max-w-4xl bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px]">
        <header className="flex items-center gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-700 px-6 py-4 rounded-t-2xl">
          {/* ... (isi header tetap sama) ... */}
          <div className="p-2 bg-blue-500/20 rounded-full">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-100 tracking-wide">Asisten Akademik</h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-xs text-green-400">Online</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4">
          {/* ... (mapping pesan tetap sama) ... */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-5 py-3 rounded-2xl text-base break-words shadow-md ${
                msg.sender === 'user'
                  ? 'self-end bg-blue-600 text-white rounded-br-lg'
                  : 'self-start bg-neutral-700 text-gray-200 rounded-bl-lg'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            // ... (indikator loading tetap sama) ...
            <div className="self-start flex items-center gap-2">
              <div className="p-2 bg-neutral-700 rounded-full">
                <Bot className="w-5 h-5 text-gray-300" />
              </div>
              <div className="bg-neutral-700 text-gray-300 px-5 py-3 rounded-2xl flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-3 border-t border-neutral-700 bg-neutral-900/50 backdrop-blur-sm px-4 py-3 rounded-b-2xl">
          <input
            type="text"
            placeholder="Ketik pertanyaan Anda di sini..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            // (BARU) Nonaktifkan input jika modal aktif
            disabled={loading || showConsentModal}
            className="flex-1 bg-neutral-800 text-gray-100 rounded-xl border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            // (BARU) Nonaktifkan tombol jika modal aktif
            disabled={loading || !input.trim() || showConsentModal}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
