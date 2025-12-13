'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { 
  Send, Bot, Loader2, RefreshCw, User, Copy, Check, BookOpen, X 
} from 'lucide-react';

// Markdown renderer
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ------------------------------------------------------------
// TYPE DEFINITIONS
// ------------------------------------------------------------
interface Message {
  sender: 'bot' | 'user';
  text: string;
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface MarkdownProps {
  children?: React.ReactNode;
  className?: string;
}

interface CategoryStructure {
  _id: string; // Nama Kategori
  topics: string[]; // List Topik
}

// ------------------------------------------------------------
// INITIAL DATA
// ------------------------------------------------------------
const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: 'Halo! Saya Asisten Akademik. Ada yang bisa saya bantu terkait informasi kampus, beasiswa, atau prosedur akademik?',
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // State untuk feedback Copy
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // State untuk Suggestion Chips (Fitur Baru)
  const [showTopicSuggestion, setShowTopicSuggestion] = useState(true);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

  // ------------------------------------------------------------
  // COPY CLIPBOARD LOGIC
  // ------------------------------------------------------------
  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ------------------------------------------------------------
  // CAPTCHA + SESSION LOGIC
  // ------------------------------------------------------------
  const createNewChatSession = async (captchaToken: string) => {
    const consentValue = userConsent || 'false';
    try {
      const res = await fetch('http://localhost:5000/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          captchaToken: captchaToken,
          consent: consentValue,
        }),
      });

      if (res.ok) {
        setIsCaptchaVerified(true);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal membuat sesi chat');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kesalahan tidak diketahui';
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `⚠️ Verifikasi gagal: ${msg}. Silakan refresh.` },
      ]);
      setIsCaptchaVerified(false);
    }
  };

  useEffect(() => {
    setUserConsent(null);
    setShowConsentModal(true);
  }, []);

  const handleConsent = (hasAgreed: boolean) => {
    setUserConsent(hasAgreed ? 'true' : 'false');
    setShowConsentModal(false);

    if (!hasAgreed) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: 'Riwayat sesi ini tidak akan disimpan untuk pelatihan AI.' },
      ]);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    if (token) createNewChatSession(token);
    else setIsCaptchaVerified(false);
  };

  // ------------------------------------------------------------
  // FETCH TOPIC STRUCTURE (FITUR BARU)
  // ------------------------------------------------------------
  const handleRequestTopics = async () => {
    if (!isCaptchaVerified) return;
    
    // 1. Sembunyikan sugesti
    setShowTopicSuggestion(false);

    // 2. Tambahkan pesan user manual
    const userMsg = "Tampilkan list topik";
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      // 3. Fetch data struktur dari backend
      const res = await fetch('http://localhost:5000/api/knowledge/structure');
      
      if (!res.ok) throw new Error("Gagal mengambil data topik.");

      const json = await res.json();
      const structure: CategoryStructure[] = json.data;

      // 4. Format data menjadi Markdown yang rapi
      let botResponse = "Berikut adalah daftar topik yang tersedia dalam basis pengetahuan kami:\n\n";

      if (structure.length === 0) {
        botResponse = "Maaf, belum ada topik yang tersedia saat ini.";
      } else {
        structure.forEach((cat) => {
          botResponse += `### 📂 ${cat._id}\n`; // Header Kategori
          cat.topics.forEach((topic) => {
            botResponse += `- ${topic}\n`; // List Item
          });
          botResponse += `\n`; // Spasi antar kategori
        });
        botResponse += "\n*Silakan ketik salah satu topik di atas untuk informasi lebih detail.*";
      }

      // 5. Tampilkan balasan bot
      setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);

    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: "⚠️ Maaf, gagal memuat daftar topik. Silakan coba lagi nanti." }]);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEND MESSAGE LOGIC
  // ------------------------------------------------------------
  const sendMessageToServer = async (userMsg: string, canSaveHistory: boolean) => {
    try {
      setLoading(true);

      const res = await fetch('http://localhost:5000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ msg: userMsg, saveHistory: canSaveHistory }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.refresh) window.location.reload();
        throw new Error(errData.message || 'Server error');
      }

      const data = await res.json();
      return data.reply || 'Maaf, saya tidak dapat menemukan jawaban yang relevan.';
    } catch (err) {
      return err instanceof Error
        ? `⚠️ Gagal terhubung: ${err.message}`
        : '⚠️ Tidak dapat terhubung ke server.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || showConsentModal || !isCaptchaVerified) return;

    setShowTopicSuggestion(false);

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);

    const botReply = await sendMessageToServer(userMsg, userConsent === 'true');

    setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
  };

  const handleRetry = async () => {
    if (loading || messages.length === 0) return;

    const lastUser = [...messages].reverse().find((m) => m.sender === 'user');
    if (!lastUser) return;

    setMessages((prev) => {
      const arr = [...prev];
      if (arr.length > 0 && arr[arr.length - 1].sender === 'bot') {
         arr.pop();
      }
      return arr;
    });

    const botReply = await sendMessageToServer(lastUser.text, userConsent === 'true');

    setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ------------------------------------------------------------
  // CODE BLOCK COMPONENT
  // ------------------------------------------------------------
  const CodeBlock = ({ inline, className, children, ...props }: CodeBlockProps) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');

    const handleCopyCode = () => {
      navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (!inline) {
      return (
        <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950">
          <div className="flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {match ? match[1] : 'text'}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded transition-colors"
              title="Copy Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />}
            </button>
          </div>
          <div className="p-4 overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200">
            <code className={className} {...props}>
              {children}
            </code>
          </div>
        </div>
      );
    }

    return (
      <code
        className="bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400"
        {...props}
      >
        {children}
      </code>
    );
  };

  // ------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------
  return (
    <section className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4 font-sans transition-colors duration-300">
      
      {/* ---------------- MODAL PERSETUJUAN ---------------- */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Privasi Percakapan
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Untuk meningkatkan kualitas jawaban AI, kami memerlukan izin untuk menyimpan riwayat percakapan ini secara anonim.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConsent(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Tanpa Simpan
              </button>
              <button
                onClick={() => handleConsent(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg shadow-blue-600/20"
              >
                Izinkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MAIN CARD ---------------- */}
      <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-none flex flex-col h-[85vh] overflow-hidden transition-colors duration-300">

        {/* HEADER */}
        <header className="flex items-center justify-between bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 px-6 py-4 z-10">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Asisten Akademik</h1>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Siap Membantu</span>
              </div>
            </div>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50 dark:bg-neutral-950 scroll-smooth">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 group ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-blue-600 dark:text-blue-400'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* MESSAGE CONTENT & ACTIONS WRAPPER */}
              <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                
                {/* BUBBLE */}
                <div
                  className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm w-full ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
                      : 'bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-neutral-800 rounded-tl-none'
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: (props: MarkdownProps) => <p className="mb-2 last:mb-0" {...props} />,
                      a: (props) => (
                        <a
                          className={`underline decoration-1 underline-offset-2 ${
                            msg.sender === 'user' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                      ul: (props) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                      ol: (props) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                      li: (props) => <li className="pl-1" {...props} />,
                      strong: (props) => <strong className="font-bold" {...props} />,
                      h1: (props) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                      h2: (props) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,
                      h3: (props) => <h3 className="text-sm font-bold mt-3 mb-1 text-blue-600 dark:text-blue-400" {...props} />,
                      blockquote: (props) => (
                        <blockquote
                          className={`border-l-4 pl-4 py-1 my-2 rounded-r italic ${
                            msg.sender === 'user' 
                              ? 'border-white/50 bg-white/10' 
                              : 'border-blue-500 bg-gray-50 dark:bg-neutral-800'
                          }`}
                          {...props}
                        />
                      ),
                      code: CodeBlock as React.ComponentType<CodeBlockProps>,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>

                {/* ACTION BAR (COPY & REGENERATE) - ONLY FOR BOT */}
                {msg.sender === 'bot' && (
                  <div className="flex items-center gap-3 mt-2 ml-1 animate-in fade-in duration-300">
                    <button 
                      onClick={() => handleCopyMessage(msg.text, i)}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      title="Salin Pesan"
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>

                    {i === messages.length - 1 && !loading && (
                      <button 
                        onClick={handleRetry}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Generate Ulang"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-300" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* CAPTCHA AREA */}
        {!showConsentModal && !isCaptchaVerified && (
          <div className="p-4 bg-gray-50 dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 flex justify-center animate-in slide-in-from-bottom-4">
            {recaptchaSiteKey ? (
              <div className="scale-90 sm:scale-100 origin-bottom">
                <ReCAPTCHA
                  sitekey={recaptchaSiteKey}
                  onChange={handleCaptchaChange}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-sm bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg">
                <span>⚠️ Konfigurasi ReCAPTCHA belum terpasang.</span>
              </div>
            )}
          </div>
        )}

        {/* INPUT AREA */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800">
          
          {/* --- TOPIC SUGGESTION (BARU) --- */}
          {showTopicSuggestion && isCaptchaVerified && !loading && (
            <div className="flex items-center justify-between w-full mb-4 animate-in slide-in-from-bottom-2 fade-in">
              
              {/* BAGIAN KIRI: Teks Penawaran */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs sm:text-sm rounded-lg border border-blue-100 dark:border-blue-900/50">
                <BookOpen className="w-4 h-4" />
                <span>Apakah kamu ingin melihat topik yang tersedia?</span>
              </div>
              
              {/* BAGIAN KANAN: Tombol Aksi */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRequestTopics}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-full shadow-md shadow-blue-600/20 transition-all active:scale-95"
                >
                  Ya, Tampilkan
                </button>
                
                <button
                  onClick={() => setShowTopicSuggestion(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  title="Tutup saran"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}
          
          <div className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              placeholder={isCaptchaVerified ? "Tanyakan sesuatu..." : "Selesaikan verifikasi di atas..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading || showConsentModal || !isCaptchaVerified}
              className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-gray-100 px-5 py-3.5 pr-14 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base shadow-inner"
            />

            <div className="absolute right-2">
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !isCaptchaVerified}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:bg-gray-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 active:scale-95"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-center mt-3 text-gray-400 dark:text-neutral-500">
            AI dapat membuat kesalahan. Mohon verifikasi informasi penting sebelum menggunakannya.
          </p>
        </div>
      </div>
    </section>
  );
}