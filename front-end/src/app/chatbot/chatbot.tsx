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

  // PERUBAHAN 1: Membuat sesi chat baru secara otomatis saat komponen dimuat
  useEffect(() => {
    const createNewChatSession = async () => {
      try {
        // Panggil endpoint di Node.js untuk membuat chat baru.
        // 'credentials: "include"' PENTING agar browser mengirim cookie session.
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
  }, []); // Array kosong berarti ini hanya berjalan sekali.

  // PERUBAHAN 2: Fungsi pengiriman diubah untuk menargetkan Node.js
  const sendMessageToServer = async (userMsg: string) => {
    try {
      setLoading(true);
      // Kirim pesan ke backend Node.js, bukan Python
      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 'credentials: "include"' PENTING agar cookie session dikirim
        credentials: 'include',
        // Body sekarang berisi 'msg' sesuai dengan appController.js
        body: JSON.stringify({ msg: userMsg }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Menangani jika sesi chat berakhir (misal karena timeout)
        if (errorData.refresh) {
          window.location.reload(); // Muat ulang halaman untuk membuat sesi baru
        }
        throw new Error(errorData.message || 'Server error');
      }

      const data = await res.json();
      // Ambil balasan dari key 'reply' sesuai controller Node.js
      return data.reply || 'Maaf, saya tidak dapat menemukan jawaban.';
    } catch (error) {
      console.error('Error fetching from Node.js backend:', error);
      return '⚠️ Gagal terhubung ke server. Pastikan semua server berjalan.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    // Panggil fungsi yang sudah diubah
    const botResponse = await sendMessageToServer(userMsg);
    setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // (Sisa kode JSX tidak berubah)
  return (
    <section className="min-h-screen flex items-center justify-center bg-gray-900 p-4 font-sans">
      <div className="w-full max-w-4xl bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col min-h-[700px]">
        <header className="flex items-center gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-700 px-6 py-4 rounded-t-2xl">
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
            className="flex-1 bg-neutral-800 text-gray-100 rounded-xl border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none px-4 py-3 transition-all duration-300"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}