'use client';
import { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Send, Bot } from 'lucide-react';

const initialMessages = [
  {
    sender: 'bot',
    text: 'Selamat datang! Ada yang bisa saya bantu terkait informasi kampus?',
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

  // Fungsi untuk membuat sesi chat baru
  const createNewChatSession = async (captchaToken: string) => {
    // Ambil consent dari state (bukan localStorage)
    const consentValue = userConsent || 'false';

    try {
      const res = await fetch('http://localhost:5000/api/create-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          captchaToken: captchaToken,
          consent: consentValue, // Mengirim consent dari state
        }),
      });

      if (res.ok) {
        console.log('Sesi chat berhasil dibuat dan persetujuan dikirim.');
        setIsCaptchaVerified(true);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal membuat sesi chat');
      }
    } catch (error: unknown) {
      console.error('Error saat membuat sesi chat:', error);

      // --- PERBAIKAN DARI 'errormessage' ---
      // Mendefinisikan errorMessage dan mengecek tipe error
      let errorMessage = 'Gagal membuat sesi chat'; // Pesan default
      if (error instanceof Error) {
        errorMessage = error.message; // Aman mengakses .message
      }
      // --- SELESAI PERBAIKAN ---

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          // Menggunakan variabel errorMessage yang sudah didefinisikan
          text: `⚠️ Gagal verifikasi: ${errorMessage}. Silakan muat ulang halaman.`,
        },
      ]);
      setIsCaptchaVerified(false);
    }
  };

  // useEffect untuk modal persetujuan
  // Selalu tampilkan modal saat halaman dimuat (tidak ada localStorage)
  useEffect(() => {
    setUserConsent(null);
    setShowConsentModal(true);
  }, []); // Hanya berjalan sekali saat komponen dimuat

  // Fungsi untuk menangani pilihan persetujuan
  const handleConsent = (hasAgreed: boolean) => {
    const consentValue = hasAgreed ? 'true' : 'false';

    // Simpan di state (tidak di localStorage)
    setUserConsent(consentValue);
    setShowConsentModal(false);

    if (!hasAgreed) {
      console.warn('Pengguna tidak setuju. History chat tidak akan disimpan.');
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Baik, history chat untuk sesi ini tidak akan disimpan.',
        },
      ]);
    }
  };

  // Fungsi untuk menangani perubahan CAPTCHA
  const handleCaptchaChange = (token: string | null) => {
    if (token) {
      // Jika token ada, kirim ke backend untuk verifikasi & buat sesi
      console.log('CAPTCHA token diterima, mengirim ke backend...', token);
      createNewChatSession(token);
    } else {
      // Jika token null (misal, expired)
      console.log('CAPTCHA challenge failed or expired.');
      setIsCaptchaVerified(false);
    }
  };

  // Fungsi untuk mengirim pesan ke server
  const sendMessageToServer = async (
    userMsg: string,
    canSaveHistory: boolean
  ) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          msg: userMsg,
          saveHistory: canSaveHistory,
        }),
      });

      if (!res.ok) {
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
      if (error instanceof Error) {
        return `⚠️ Gagal terhubung: ${error.message}`;
      }
      return '⚠️ Gagal terhubung ke server. Pastikan semua server berjalan.';
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk tombol "Kirim"
  const handleSend = async () => {
    if (!input.trim() || showConsentModal || !isCaptchaVerified) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    // Cek persetujuan dari state
    const canSaveHistory = userConsent === 'true';
    const botResponse = await sendMessageToServer(userMsg, canSaveHistory);
    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
  };

  // Efek untuk auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- (Bagian JSX tidak ada perubahan, semua logika sudah benar) ---
  return (
    <section className='min-h-screen flex items-center justify-center bg-gray-900 p-4 font-sans relative'>
      {/* Modal Persetujuan */}
      {showConsentModal && (
        <div className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'>
          <div className='bg-neutral-800 p-6 rounded-lg shadow-lg max-w-sm w-full text-center border border-neutral-700'>
            <h3 className='text-lg font-semibold text-white mb-4'>
              Persetujuan History Chat
            </h3>
            <p className='text-sm text-gray-300 mb-6'>
              Apakah Anda mengizinkan kami menyimpan history chat dan dilihat
              oleh admin untuk peningkatan kualitas layanan?
            </p>
            <div className='flex justify-center gap-4'>
              <button
                onClick={() => handleConsent(false)}
                className='px-4 py-2 rounded-lg bg-neutral-600 hover:bg-neutral-500 text-white font-medium transition-colors'
              >
                Tidak Setuju
              </button>
              <button
                onClick={() => handleConsent(true)}
                className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors'
              >
                Setuju
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konten Chatbot Utama */}
      <div className='w-full max-w-4xl bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px]'>
        {/* Header */}
        <header className='flex items-center gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-700 px-6 py-4 rounded-t-2xl'>
          <div className='p-2 bg-blue-500/20 rounded-full'>
            <Bot className='w-6 h-6 text-blue-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-gray-100 tracking-wide'>
              Asisten Akademik
            </h1>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></div>
              <p className='text-xs text-green-400'>Online</p>
            </div>
          </div>
        </header>

        {/* Area Pesan */}
        <div className='flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-4'>
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
            <div className='self-start flex items-center gap-2'>
              <div className='p-2 bg-neutral-700 rounded-full'>
                <Bot className='w-5 h-5 text-gray-300' />
              </div>
              <div className='bg-neutral-700 text-gray-300 px-5 py-3 rounded-2xl flex items-center gap-1'>
                <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75'></span>
                <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200'></span>
                <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300'></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Area Verifikasi CAPTCHA */}
        {!showConsentModal && !isCaptchaVerified && (
          <div className='flex flex-col items-center justify-center px-6 py-4 border-t border-neutral-700'>
            <p className='text-sm text-gray-300 mb-3'>
              Silakan verifikasi untuk memulai chat.
            </p>

            {recaptchaSiteKey ? (
              <ReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={handleCaptchaChange}
                theme='dark'
              />
            ) : (
              <p className='text-sm text-red-500 font-medium px-4 py-2 bg-red-900/20 rounded-md'>
                Error: Kunci ReCAPTCHA tidak ditemukan.
                <br />
                Pastikan .env sudah benar dan server sudah di-restart.
              </p>
            )}
          </div>
        )}

        {/* Area Input */}
        <div className='flex items-center gap-3 border-t border-neutral-700 bg-neutral-900/50 backdrop-blur-sm px-4 py-3 rounded-b-2xl'>
          <input
            type='text'
            placeholder='Ketik pertanyaan Anda di sini...'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
            disabled={loading || showConsentModal || !isCaptchaVerified}
            className='flex-1 bg-neutral-800 text-gray-100 rounded-xl border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300 disabled:opacity-50'
          />
          <button
            onClick={handleSend}
            disabled={
              loading || !input.trim() || showConsentModal || !isCaptchaVerified
            }
            className='p-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <Send className='w-5 h-5' />
          </button>
        </div>
      </div>
    </section>
  );
}