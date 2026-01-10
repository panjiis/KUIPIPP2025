'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image'; // Import Image dari Next.js
import ReCAPTCHA from 'react-google-recaptcha';
import {
  Send,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  BookOpen,
  X,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';

// --- LIBRARY MARKDOWN & HTML PARSER ---
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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

interface CategoryStructure {
  _id: string;
  topics: string[];
}

// ------------------------------------------------------------
// INITIAL DATA
// ------------------------------------------------------------
const initialMessages: Message[] = [
  {
    sender: 'bot',
    text: "Hello! I'm an Academic Assistant from the International Office. How can I help you with campus information, scholarships, or academic procedures?",
  },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentBotMessageRef = useRef<string>('');

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Copy Feedback State
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Suggestions State
  const [showTopicSuggestion, setShowTopicSuggestion] = useState(true);

  // Auth & Captcha
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState<string | null>(null);
  const userConsentRef = useRef<string | null>(null);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);

  // WebSocket State
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>(
    'CLOSED'
  );

  // ------------------------------------------------------------
  // THEME LOGIC
  // ------------------------------------------------------------
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // ------------------------------------------------------------
  // LOGGING
  // ------------------------------------------------------------
  const logChatToBackend = useCallback(
    async (sender: 'user' | 'bot', msg: string) => {
      // BACA DARI REF (Selalu fresh value)
      if (userConsentRef.current !== 'true') {
        console.warn('Logging skipped: Consent is', userConsentRef.current);
        return;
      }

      try {
        console.log(`📝 Saving ${sender} msg to DB...`); // Debug log
        await fetch('http://localhost:5000/api/send-msg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sender, msg, isLogOnly: true }),
        });
      } catch (error) {
        console.warn('Failed logging chat', error);
      }
    },
    [] // Dependency kosong agar fungsi stabil (tidak re-create)
  );

  // ------------------------------------------------------------
  // WEBSOCKET
  // ------------------------------------------------------------
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080/ws');

    socket.onopen = () => {
      console.log('✅ Connected to AI Server (WS)');
      setWsStatus('OPEN');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 1. Tipe STREAM: Tambahkan token ke pesan terakhir
        if (data.type === 'stream') {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];

            // Pastikan pesan terakhir adalah milik BOT
            if (lastMsg.sender === 'bot') {
              lastMsg.text += data.token;
              return newMessages;
            } else {
              // Jika belum ada pesan bot (race condition), buat baru
              return [...prev, { sender: 'bot', text: data.token }];
            }
          });
          // Update ref juga untuk sinkronisasi
          currentBotMessageRef.current += data.token;
        }

        // 2. Tipe END: Stream selesai, simpan ke database (Log)
        else if (data.type === 'end') {
          setLoading(false);
          // Simpan full text ke database agar Admin History bisa baca utuh
          logChatToBackend('bot', data.full_text);
          currentBotMessageRef.current = ''; // Reset ref
        }

        // 3. Fallback (Logic lama jika server mengirim format lama)
        else if (data.Reply) {
          setMessages((prev) => [...prev, { sender: 'bot', text: data.Reply }]);
          setLoading(false);
          logChatToBackend('bot', data.Reply);
        }
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    socket.onclose = () => {
      console.log('❌ Disconnected from AI Server');
      setWsStatus('CLOSED');
      setLoading(false);
    };

    socket.onerror = (err) => {
      console.error('⚠️ WebSocket Error:', err);
      setWsStatus('CLOSED');
      setLoading(false);
    };

    setWs(socket);
    return () => socket.close();
  }, [logChatToBackend]);

  // ------------------------------------------------------------
  // COPY FUNCTION
  // ------------------------------------------------------------
  const handleCopyMessage = (text: string, index: number) => {
    const cleanText = text.replace(/<[^>]*>?/gm, '');
    navigator.clipboard.writeText(cleanText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ------------------------------------------------------------
  // AUTH & CAPTCHA
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
        throw new Error(errorData.message || 'Failed to create chat session');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ Verification failed: ${msg}. Please refresh.`,
        },
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
    const val = hasAgreed ? 'true' : 'false';
    setUserConsent(val);
    userConsentRef.current = val; // UPDATE REF DI SINI
    setShowConsentModal(false);
    if (!hasAgreed) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'This session history will not be saved for AI training.',
        },
      ]);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    if (token) createNewChatSession(token);
    else setIsCaptchaVerified(false);
  };

  // ------------------------------------------------------------
  // TOPICS
  // ------------------------------------------------------------
  const handleRequestTopics = async () => {
    if (!isCaptchaVerified) return;
    setShowTopicSuggestion(false);
    const userMsg = 'Tampilkan list topik';
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/knowledge/structure');
      if (!res.ok) throw new Error('Failed to fetch topic data.');
      const json = await res.json();
      const structure: CategoryStructure[] = json.data;

      let botResponse = 'Berikut adalah daftar topik yang tersedia:\n\n';
      if (structure.length === 0) {
        botResponse = 'Maaf, belum ada topik yang tersedia saat ini.';
      } else {
        structure.forEach((cat) => {
          botResponse += `### 📂 ${cat._id}\n`;
          cat.topics.forEach((topic) => {
            botResponse += `- ${topic}\n`;
          });
          botResponse += `\n`;
        });
        botResponse +=
          '\n*Silakan ketik salah satu topik di atas untuk detail.*';
      }
      setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ Maaf, gagal memuat daftar topik. Silakan coba lagi.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SEND LOGIC
  // ------------------------------------------------------------
  const handleSend = async () => {
    if (!input.trim() || showConsentModal || !isCaptchaVerified) return;
    if (wsStatus !== 'OPEN' || !ws) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ Koneksi ke server terputus. Silakan refresh halaman.',
        },
      ]);
      return;
    }

    setShowTopicSuggestion(false);
    const userMsg = input;
    setInput('');

    // 1. Tambahkan pesan User
    // 2. Tambahkan pesan Bot KOSONG (placeholder untuk stream)
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: userMsg },
      { sender: 'bot', text: '' }, // Placeholder kosong
    ]);

    setLoading(true);
    currentBotMessageRef.current = ''; // Reset ref stream

    // Kirim pesan ke server
    ws.send(JSON.stringify({ message: userMsg }));

    // Log pesan USER ke DB segera
    logChatToBackend('user', userMsg);
  };

  const handleRetry = async () => {
    if (loading || messages.length === 0 || wsStatus !== 'OPEN' || !ws) return;

    // Cari pesan user terakhir
    const reversedMsgs = [...messages].reverse();
    const lastUserMsg = reversedMsgs.find((m) => m.sender === 'user');
    if (!lastUserMsg) return;

    // Hapus pesan bot terakhir (yang mau di-regenerate)
    setMessages((prev) => {
      const arr = [...prev];
      if (arr.length > 0 && arr[arr.length - 1].sender === 'bot') {
        arr.pop();
      }
      // Tambahkan placeholder baru
      arr.push({ sender: 'bot', text: '' });
      return arr;
    });

    setLoading(true);
    currentBotMessageRef.current = '';
    ws.send(JSON.stringify({ message: lastUserMsg.text }));
  };

  // ------------------------------------------------------------
  // CODE BLOCK COMPONENT
  // ------------------------------------------------------------
  const CodeBlock = ({
    inline,
    className,
    children,
    ...props
  }: CodeBlockProps) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');

    const handleCopyCode = () => {
      navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (!inline) {
      return (
        <div
          className='relative group my-4 rounded-lg overflow-hidden border bg-black/5 dark:bg-black/30'
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className='flex justify-between items-center px-4 py-2 bg-black/5 dark:bg-white/5 border-b'
            style={{ borderColor: 'var(--border)' }}
          >
            <span className='text-xs font-mono opacity-70'>
              {match ? match[1] : 'text'}
            </span>
            <button
              onClick={handleCopyCode}
              className='p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors'
              title='Copy Code'
            >
              {copied ? (
                <Check className='w-3.5 h-3.5 text-green-500' />
              ) : (
                <Copy className='w-3.5 h-3.5 opacity-70' />
              )}
            </button>
          </div>
          <div
            className='p-4 overflow-x-auto text-sm font-mono'
            style={{ color: 'var(--foreground)' }}
          >
            <code className={className} {...props}>
              {children}
            </code>
          </div>
        </div>
      );
    }
    return (
      <code
        className='px-1.5 py-0.5 rounded text-sm font-mono bg-black/10 dark:bg-white/10'
        style={{ color: 'var(--foreground)' }}
        {...props}
      >
        {children}
      </code>
    );
  };

  if (!mounted) return null;

  // ------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------
  return (
    <section className='min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans transition-colors duration-300'>
      {/* --- CONSENT MODAL --- */}
      {showConsentModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300'>
          <div className='glass-card p-6 max-w-sm w-full shadow-2xl ring-1 ring-white/20'>
            <h3
              className='text-xl font-bold mb-3'
              style={{ color: 'var(--foreground)' }}
            >
              Privacy Consent
            </h3>
            <p
              className='text-sm mb-6 leading-relaxed opacity-90'
              style={{ color: 'var(--foreground)' }}
            >
              To improve the quality of AI answers, we need permission to store
              this conversation history anonymously.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => handleConsent(false)}
                className='flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 transition-colors'
              >
                Reject
              </button>
              <button
                onClick={() => handleConsent(true)}
                className='flex-1 py-2.5 rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all'
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN CHAT CONTAINER --- */}
      <div
        className='w-full max-w-5xl glass-card flex flex-col h-[85vh] overflow-hidden shadow-2xl relative'
        style={{
          borderColor: 'var(--border)',
          borderWidth: '1px',
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* --- HEADER --- */}
        <header
          className='flex items-center justify-between px-6 py-4 border-b backdrop-blur-xl z-10'
          style={{
            borderColor: 'var(--border)',
            background:
              'linear-gradient(to right, rgba(255,255,255,0.4), rgba(255,255,255,0.1))',
          }}
        >
          <div className='flex items-center gap-4'>
            <div className='relative'>
              {/* HEADER ICON
                  - Menggunakan 'bg-white' agar logo transparan terlihat jelas
                  - 'object-contain' agar gambar tidak terpotong 
                  - Padding 'p-1' agar ada ruang napas
                */}
              <div
                className='w-11 h-11 rounded-xl shadow-lg flex items-center justify-center overflow-hidden bg-white relative'
                style={{ border: '1px solid var(--border)' }}
              >
                <Image
                  src='/Logo1.jpg'
                  alt='Bot Logo'
                  fill
                  sizes='44px'
                  className='object-contain p-1'
                />
              </div>

              {/* Online Status Dot */}
              <div className='absolute -bottom-1 -right-1 flex h-3.5 w-3.5'>
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    wsStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white dark:border-gray-900 ${
                    wsStatus === 'OPEN' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                ></span>
              </div>
            </div>

            <div>
              <h1
                className='text-lg font-bold tracking-tight'
                style={{ color: 'var(--foreground)' }}
              >
                KUI UNPAD Assistant
              </h1>
              <p
                className='text-xs font-medium opacity-70 flex items-center gap-1.5'
                style={{ color: 'var(--foreground)' }}
              >
                <span className='w-1.5 h-1.5 rounded-full bg-current opacity-50'></span>
                Universitas Padjadjaran
              </p>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className='p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all border border-transparent hover:border-border'
          >
            {isDarkMode ? (
              <Sun className='w-5 h-5' style={{ color: 'var(--foreground)' }} />
            ) : (
              <Moon
                className='w-5 h-5'
                style={{ color: 'var(--foreground)' }}
              />
            )}
          </button>
        </header>

        {/* --- CHAT AREA --- */}
        <div className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth custom-scrollbar'>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 group ${
                msg.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* AVATAR CHAT */}
              <div
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md border overflow-hidden relative bg-white`}
                style={{
                  borderColor: 'var(--border)',
                }}
              >
                {/* USER & BOT AVATARS
                  - Menggunakan 'bg-white' pada container di atas
                  - 'object-contain' agar logo full
                */}
                <Image
                  src={msg.sender === 'user' ? '/Logo.jpg' : '/Logo1.jpg'}
                  alt={msg.sender}
                  fill
                  sizes='40px'
                  className='object-contain p-0.5' // P-0.5 memberi sedikit jarak dari pinggir lingkaran
                />
              </div>

              {/* Message Wrapper */}
              <div
                className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* BUBBLE */}
                <div
                  className={`px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm relative ${
                    msg.sender === 'user'
                      ? 'rounded-tr-none text-white'
                      : 'rounded-tl-none border'
                  }`}
                  style={
                    msg.sender === 'user'
                      ? {
                          background:
                            'linear-gradient(135deg, var(--primary), var(--accent))',
                          color: 'var(--primary-foreground)',
                          boxShadow: '0 4px 15px -3px rgba(0,0,0,0.1)',
                        }
                      : {
                          background: 'var(--card-bg)',
                          color: 'var(--foreground)',
                          borderColor: 'var(--border)',
                        }
                  }
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      table: ({ ...props }) => (
                        <div
                          className='overflow-x-auto my-3 border rounded-lg bg-black/5 dark:bg-white/5'
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <table
                            className='min-w-full divide-y text-left text-xs'
                            style={{ borderColor: 'var(--border)' }}
                            {...props}
                          />
                        </div>
                      ),
                      thead: ({ ...props }) => (
                        <thead
                          className='bg-black/5 dark:bg-white/5'
                          {...props}
                        />
                      ),
                      th: ({ ...props }) => (
                        <th
                          className='px-3 py-2 font-semibold opacity-80'
                          {...props}
                        />
                      ),
                      tbody: ({ ...props }) => (
                        <tbody
                          className='divide-y'
                          style={{ borderColor: 'var(--border)' }}
                          {...props}
                        />
                      ),
                      td: ({ ...props }) => (
                        <td
                          className='px-3 py-2 whitespace-pre-wrap align-top'
                          {...props}
                        />
                      ),
                      a: (props) => (
                        <a
                          {...props}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='underline underline-offset-2 font-semibold opacity-90 hover:opacity-100'
                        />
                      ),
                      p: (props) => <p className='mb-2 last:mb-0' {...props} />,
                      ul: (props) => (
                        <ul
                          className='list-disc ml-4 mb-2 space-y-1'
                          {...props}
                        />
                      ),
                      ol: (props) => (
                        <ol
                          className='list-decimal ml-4 mb-2 space-y-1'
                          {...props}
                        />
                      ),
                      li: (props) => <li className='pl-1' {...props} />,
                      strong: (props) => (
                        <strong className='font-bold' {...props} />
                      ),
                      h1: (props) => (
                        <h1
                          className='text-lg font-bold mt-2 mb-2'
                          {...props}
                        />
                      ),
                      h2: (props) => (
                        <h2
                          className='text-base font-bold mt-2 mb-2'
                          {...props}
                        />
                      ),
                      h3: (props) => (
                        <h3
                          className='text-sm font-bold mt-2 mb-1'
                          {...props}
                        />
                      ),
                      code: CodeBlock as React.ComponentType<CodeBlockProps>,
                      blockquote: (props) => (
                        <blockquote
                          className='border-l-4 pl-4 py-1 my-2 italic opacity-80'
                          style={{
                            borderColor: 'currentColor',
                            background: 'rgba(255,255,255,0.1)',
                          }}
                          {...props}
                        />
                      ),
                    }}
                  >
                    {typeof msg.text === 'string'
                      ? msg.text
                      : String(msg.text || '')}
                  </ReactMarkdown>
                </div>

                {/* Footer Message (Copy & Regenerate) - ALWAYS VISIBLE */}
                {msg.sender === 'bot' && (
                  <div className='flex items-center gap-3 mt-2 ml-1'>
                    <button
                      onClick={() => handleCopyMessage(msg.text, i)}
                      className='flex items-center gap-1 text-[10px] font-medium hover:text-emerald-500 transition-colors'
                      style={{
                        color:
                          copiedIndex === i
                            ? '#10B981'
                            : 'var(--muted-foreground)',
                      }}
                    >
                      {copiedIndex === i ? (
                        <Check className='w-3 h-3' />
                      ) : (
                        <Copy className='w-3 h-3' />
                      )}
                      <span>{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                    </button>

                    {i === messages.length - 1 && !loading && (
                      <button
                        onClick={handleRetry}
                        className='flex items-center gap-1 text-[10px] font-medium hover:text-amber-500 transition-colors'
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <RefreshCw className='w-3 h-3' />
                        <span>Regenerate</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className='flex gap-4 animate-pulse'>
              <div
                className='w-10 h-10 rounded-full border flex items-center justify-center bg-white overflow-hidden relative'
                style={{ borderColor: 'var(--border)' }}
              >
                <Image
                  src='/Logo1.jpg'
                  alt='Bot Loading'
                  fill
                  sizes='40px'
                  className='object-contain p-0.5'
                />
              </div>
              <div
                className='px-5 py-4 rounded-2xl rounded-tl-none border flex items-center gap-2'
                style={{
                  background: 'var(--card-bg)',
                  borderColor: 'var(--border)',
                }}
              >
                <span
                  className='w-2 h-2 rounded-full animate-bounce'
                  style={{ background: 'var(--primary)' }}
                ></span>
                <span
                  className='w-2 h-2 rounded-full animate-bounce delay-150'
                  style={{ background: 'var(--primary)', opacity: 0.7 }}
                ></span>
                <span
                  className='w-2 h-2 rounded-full animate-bounce delay-300'
                  style={{ background: 'var(--primary)', opacity: 0.4 }}
                ></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* --- CAPTCHA AREA --- */}
        {!showConsentModal && !isCaptchaVerified && (
          <div
            className='p-4 border-t flex justify-center bg-black/5 dark:bg-black/20'
            style={{ borderColor: 'var(--border)' }}
          >
            {recaptchaSiteKey ? (
              <ReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={handleCaptchaChange}
                theme={isDarkMode ? 'dark' : 'light'}
              />
            ) : (
              <div className='flex items-center gap-2 text-amber-600 text-sm bg-amber-50/50 px-4 py-2 rounded-lg border border-amber-200'>
                <AlertTriangle className='w-4 h-4' />
                <span>⚠️ ReCAPTCHA configuration is missing.</span>
              </div>
            )}
          </div>
        )}

        {/* --- FOOTER INPUT AREA --- */}
        <div
          className='p-5 border-t backdrop-blur-md'
          style={{
            borderColor: 'var(--border)',
            background:
              'linear-gradient(to top, var(--card-bg), rgba(255,255,255,0.0))',
          }}
        >
          {/* Suggestion Chips */}
          {showTopicSuggestion && isCaptchaVerified && !loading && (
            <div className='flex items-center justify-between bg-black/5 dark:bg-white/5 px-4 py-2 rounded-lg mb-4 border border-transparent hover:border-border transition-colors'>
              <div
                className='flex items-center gap-2 text-xs sm:text-sm opacity-80'
                style={{ color: 'var(--foreground)' }}
              >
                <BookOpen className='w-4 h-4 text-amber-500' />
                <span>
                  Not sure what to ask? Check out the available topics.
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  onClick={handleRequestTopics}
                  className='text-xs font-bold px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity'
                  style={{
                    background: 'var(--secondary)',
                    color: 'var(--secondary-foreground)',
                  }}
                >
                  View Topics
                </button>
                <button
                  onClick={() => setShowTopicSuggestion(false)}
                  className='p-1 hover:bg-black/10 rounded-full transition-colors'
                >
                  <X className='w-4 h-4 opacity-50' />
                </button>
              </div>
            </div>
          )}

          <div className='relative flex items-center max-w-4xl mx-auto'>
            <input
              type='text'
              placeholder={
                isCaptchaVerified
                  ? 'Ketik pertanyaan Anda di sini...'
                  : 'Selesaikan verifikasi di atas...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={
                loading ||
                showConsentModal ||
                !isCaptchaVerified ||
                wsStatus !== 'OPEN'
              }
              className='w-full pl-6 pr-14 py-4 rounded-full outline-none text-sm transition-all shadow-inner focus:ring-2'
              style={
                {
                  background: isDarkMode
                    ? 'rgba(0,0,0,0.3)'
                    : 'rgba(255,255,255,0.8)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  '--tw-ring-color': 'var(--primary)',
                  '--tw-ring-opacity': '0.3',
                } as React.CSSProperties
              }
            />

            <div className='absolute right-2'>
              <button
                onClick={handleSend}
                disabled={
                  !input.trim() ||
                  loading ||
                  !isCaptchaVerified ||
                  wsStatus !== 'OPEN'
                }
                className='p-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
                style={{
                  background: input.trim() ? 'var(--primary)' : 'var(--muted)',
                  color: input.trim()
                    ? 'var(--primary-foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                {loading ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Send className='w-5 h-5 ml-0.5' />
                )}
              </button>
            </div>
          </div>

          <p
            className='text-[10px] text-center mt-3 opacity-60 font-medium'
            style={{ color: 'var(--foreground)' }}
          >
            AI dapat membuat kesalahan. Mohon verifikasi informasi penting
            sebelum menggunakannya.
          </p>
        </div>
      </div>
    </section>
  );
}
