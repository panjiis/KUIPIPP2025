'use client';
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Trash2,
  AlertTriangle,
  FileText,
  Download,
  User,
  Search,
  Bot,
} from 'lucide-react';
import KnowledgeView from './knowledge-view';

interface Attachment {
  type: string;
  name: string;
  status: string;
  url?: string;
  errorMessage?: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  attachment?: Attachment;
}

interface Conversation {
  id: string;
  userId: string;
  timestamp: string;
  lastMessage: string;
  hasError?: boolean;
  messages: Message[];
}

// --- (MOCK DATA) ---
const mockConversations: Conversation[] = [
  {
    id: 'conv-001',
    userId: 'user-xyz-789',
    timestamp: '2025-10-16T10:30:00Z',
    lastMessage: 'Oke, terima kasih atas bantuannya!',
    messages: [
      { sender: 'user', text: 'Halo, saya mau tanya soal jadwal KKN.' },
      {
        sender: 'bot',
        text: 'Tentu, pendaftaran KKN akan dibuka mulai tanggal 1 November 2025. Informasi lebih lanjut bisa dilihat di website kemahasiswaan.',
      },
      { sender: 'user', text: 'Oke, terima kasih atas bantuannya!' },
    ],
  },
  {
    id: 'conv-002',
    userId: 'user-abc-123',
    timestamp: '2025-10-16T09:15:00Z',
    lastMessage: 'Tidak bisa dibuka filenya.',
    hasError: true,
    messages: [
      { sender: 'user', text: 'Bisa berikan saya template surat pengantar?' },
      { sender: 'bot', text: 'Tentu, ini filenya.' },
      {
        sender: 'user',
        text: 'Tidak bisa dibuka filenya.',
        attachment: {
          type: 'pdf',
          name: 'Surat_Pengantar_Magang.pdf',
          status: 'error',
          errorMessage: 'Gagal diunggah oleh pengguna, file korup.',
        },
      },
    ],
  },
  {
    id: 'conv-003',
    userId: 'user-def-456',
    timestamp: '2025-10-15T14:00:00Z',
    lastMessage: 'Ini screenshot errornya.',
    messages: [
      { sender: 'user', text: 'Website SIAKAD sedang error.' },
      {
        sender: 'bot',
        text: 'Bisa tolong kirimkan screenshotnya agar kami bisa periksa?',
      },
      {
        sender: 'user',
        text: 'Ini screenshot errornya.',
        attachment: {
          type: 'image',
          name: 'SIAKAD_Error.png',
          status: 'success',
          url: 'https://via.placeholder.com/400x200.png?text=Contoh+Error',
        },
      },
      {
        sender: 'bot',
        text: 'Terima kasih atas laporannya. Tim teknis kami akan segera memeriksanya.',
      },
    ],
  },
];

// --- (AKHIR MOCK DATA) ---

export default function AdminDashboard() {
  const [conversations, setConversations] =
    useState<Conversation[]>(mockConversations);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showKnowledgeView, setShowKnowledgeView] = useState(false);

  useEffect(() => setMounted(true), []);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteChat = (id: string) => {
    if (
      window.confirm(
        'Apakah Anda yakin ingin menghapus riwayat percakapan ini secara permanen?'
      )
    ) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setSelectedConversation(null);
    }
  };

  const handleViewChange = () => setShowKnowledgeView(!showKnowledgeView);

  // 🔁 Switch View ke KnowledgeView
  if (showKnowledgeView) {
    return <KnowledgeView onBack={handleViewChange} />;
  }

  return (
    <div className='bg-gray-900 min-h-screen text-gray-200 font-sans p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-white tracking-tight'>
            Admin Dashboard
          </h1>
          <p className='text-gray-400 mt-1'>
            Manajemen dan monitoring aktivitas chatbot.
          </p>
        </header>

        {/* Quick Actions - DIUBAH MENJADI HANYA 1 KOLOM */}
        <section className='grid grid-cols-1 gap-6 mb-8'>
          {/* Knowledge View Button Card - DIUBAH */}
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between'>
            <div className='mb-4 sm:mb-0'>
              <h2 className='text-lg font-semibold text-white'>
                Knowledge View
              </h2>
              <p className='text-sm text-gray-400 mt-1'>
                Ganti ke tampilan update pengetahuan
              </p>
            </div>
            {/* Tombol Change to Knowledge View dibuat full width di mobile dan fleksibel di desktop */}
            <button
              onClick={handleViewChange}
              className='flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors w-full sm:w-auto' // w-full di sini
            >
              <RefreshCw className='w-5 h-5' />
              <span>Change to Knowledge View</span>
            </button>
          </div>


        </section>

        {/* Chat History */}
        <section className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* List */}
          <div className='lg:col-span-1 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
            <div className='p-4 border-b border-neutral-700'>
              <h2 className='text-lg font-semibold flex items-center mb-4 gap-2'>
                <MessageSquare /> Riwayat Percakapan
              </h2>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
                <input
                  type='text'
                  placeholder='Cari ID percakapan atau user...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-neutral-900 text-gray-200 rounded-lg border border-neutral-600 pl-10 pr-4 py-2 text-sm'
                />
              </div>
            </div>

            <div className='overflow-y-auto flex-1'>
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full text-left p-4 border-l-4 hover:bg-neutral-700/50 ${
                      selectedConversation?.id === conv.id
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'border-transparent'
                    }`}
                  >
                    <div className='flex justify-between items-center'>
                      <p className='font-bold text-white text-sm'>
                        {conv.userId}
                      </p>
                      {conv.hasError && (
                        <AlertTriangle className='w-4 h-4 text-yellow-400' />
                      )}
                    </div>
                    <p className='text-sm text-gray-400 truncate mt-1'>
                      {conv.lastMessage}
                    </p>
                    <p className='text-xs text-gray-500 mt-2'>
                      {mounted ? new Date(conv.timestamp).toLocaleString() : ''}
                    </p>
                  </button>
                ))
              ) : (
                <div className='text-center text-gray-500 p-8'>
                  <p>Percakapan tidak ditemukan.</p>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className='lg:col-span-2 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
            {selectedConversation ? (
              <>
                <header className='p-4 border-b border-neutral-700 flex justify-between items-center'>
                  <div>
                    <h3 className='font-bold text-white'>Detail Percakapan</h3>
                    <p className='text-sm text-gray-400'>
                      {selectedConversation.id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteChat(selectedConversation.id)}
                    className='flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-2 rounded-lg'
                  >
                    <Trash2 className='w-4 h-4' />
                    <span>Hapus</span>
                  </button>
                </header>

                <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-5'>
                  {selectedConversation.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 max-w-[85%] ${
                        msg.sender === 'user'
                          ? 'self-end flex-row-reverse'
                          : 'self-start'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-full ${
                          msg.sender === 'user'
                            ? 'bg-blue-600'
                            : 'bg-neutral-600'
                        }`}
                      >
                        {msg.sender === 'user' ? (
                          <User className='w-4 h-4 text-white' />
                        ) : (
                          <Bot className='w-4 h-4 text-white' />
                        )}
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-700 text-gray-200'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.attachment && (
                          <div
                            className={`mt-3 p-3 rounded-lg border ${
                              msg.attachment.status === 'error'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-gray-500/10 border-gray-500/30'
                            }`}
                          >
                            <div className='flex items-center gap-3'>
                              {msg.attachment.status === 'error' ? (
                                <AlertTriangle className='w-8 h-8 text-red-400' />
                              ) : (
                                <FileText className='w-8 h-8 text-gray-300' />
                              )}
                              <div>
                                <p className='font-semibold text-sm text-white'>
                                  {msg.attachment.name}
                                </p>
                                {msg.attachment.status === 'error' ? (
                                  <p className='text-xs text-red-400'>
                                    {msg.attachment.errorMessage}
                                  </p>
                                ) : (
                                  <a
                                    href={msg.attachment.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-xs text-blue-400 hover:underline flex items-center gap-1'
                                  >
                                    <Download className='w-3 h-3' />
                                    Lihat/Unduh Gambar
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className='flex flex-col items-center justify-center h-full text-gray-500'>
                <MessageSquare className='w-16 h-16 mb-4' />
                <h3 className='text-xl font-semibold'>Pilih Percakapan</h3>
                <p>
                  Pilih salah satu percakapan dari daftar di sebelah kiri untuk
                  melihat detailnya.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
