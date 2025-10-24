'use client';
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Trash2,
  AlertTriangle,
  User,
  Search,
  Bot,
  Loader2, // <-- Impor ikon untuk loading
} from 'lucide-react';
import KnowledgeView from './knowledge-view';

// Tipe data disesuaikan dengan data asli dari backend
interface ChatSession {
  _id: string;
  status: string;
  createdAt: string;
}

interface Message {
  sender: 'user' | 'bot';
  msg: string;
  createdAt: string;
}

interface SelectedConversation {
  _id: string;
  status: string;
  messages: Message[];
}

export default function AdminDashboard() {
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SelectedConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showKnowledgeView, setShowKnowledgeView] = useState(false);

  // Fungsi untuk mengambil daftar semua chat
  const fetchChatList = async () => {
    try {
      setListLoading(true);
      const res = await fetch('http://localhost:5000/api/admin/chats/all', {
        credentials: 'include', // PENTING untuk mengirim cookie session
      });

      if (res.status === 401) {
        window.location.href = '/login'; // Ganti dengan URL login Anda
        return;
      }
      if (!res.ok) throw new Error('Gagal mengambil daftar chat.');

      const data = await res.json();
      setChatList(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setListLoading(false);
    }
  };

  // Mengambil daftar chat saat komponen pertama kali dimuat
  useEffect(() => {
    fetchChatList();
  }, []);

  // Fungsi untuk mengambil detail history saat chat diklik
  const handleSelectConversation = async (chatId: string) => {
    // Hindari fetch ulang jika chat yang sama diklik
    if (selectedConversation?._id === chatId) return;
    
    try {
      setDetailLoading(true);
      setSelectedConversation(null);

      const res = await fetch(
        `http://localhost:5000/api/admin/chats/history?chatId=${chatId}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Gagal mengambil riwayat chat.');

      const data = await res.json();
      
      const transformedMessages = data.data.map((msg: any) => ({
        ...msg,
        sender: msg.sender === 'USER' ? 'user' : 'bot',
      }));

      const currentChat = chatList.find(chat => chat._id === chatId);

      setSelectedConversation({
        _id: chatId,
        status: currentChat?.status || 'UNKNOWN',
        messages: transformedMessages,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fungsi untuk menghapus chat spesifik
  const handleDeleteChat = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus percakapan ini secara permanen?')) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/admin/chats/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Gagal menghapus chat.');

      // Update UI setelah berhasil hapus
      setChatList((prev) => prev.filter((c) => c._id !== id));
      setSelectedConversation(null);
      alert('Percakapan berhasil dihapus.');

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Fungsi untuk menghapus chat lama
  const handleDeleteOldChats = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus semua chat lama (NONACTIVE > 7 hari)?')) return;
    
    try {
      const res = await fetch('http://localhost:5000/api/admin/chats/delete-old', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Gagal menghapus chat lama.');

      const result = await res.json();
      alert(result.message);
      fetchChatList(); // Muat ulang daftar chat setelah penghapusan

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };


  const filteredConversations = chatList.filter((conv) =>
    conv._id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewChange = () => setShowKnowledgeView(!showKnowledgeView);

  if (showKnowledgeView) {
    return <KnowledgeView onBack={handleViewChange} />;
  }

  return (
    <div className='bg-gray-900 min-h-screen text-gray-200 font-sans p-4 sm:p-6 lg:p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold text-white tracking-tight'>
            Admin Dashboard
          </h1>
          <p className='text-gray-400 mt-1'>
            Manajemen dan monitoring aktivitas chatbot.
          </p>
        </header>

        {/* Quick Actions */}
        <section className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Knowledge View</h2>
              <p className='text-sm text-gray-400 mt-1'>Ganti ke tampilan update pengetahuan.</p>
            </div>
            <button
              onClick={handleViewChange}
              className='flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg'
            >
              <RefreshCw className='w-5 h-5' />
              <span>Ganti Tampilan</span>
            </button>
          </div>
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Tindakan Massal</h2>
              <p className='text-sm text-gray-400 mt-1'>Hapus semua chat lama yang tidak aktif.</p>
            </div>
            <button
              onClick={handleDeleteOldChats}
              className='flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-4 py-2 rounded-lg'
            >
              <Trash2 className='w-5 h-5' />
              <span>Hapus Chat Lama</span>
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
                  placeholder='Cari ID percakapan...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-neutral-900 text-gray-200 rounded-lg border border-neutral-600 pl-10 pr-4 py-2 text-sm'
                />
              </div>
            </div>

            <div className='overflow-y-auto flex-1'>
              {listLoading ? (
                <div className='flex justify-center items-center h-full text-gray-500'>
                  <Loader2 className='w-8 h-8 animate-spin' />
                </div>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => (
                  <button
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv._id)}
                    className={`w-full text-left p-4 border-l-4 hover:bg-neutral-700/50 ${
                      selectedConversation?._id === conv._id
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'border-transparent'
                    }`}
                  >
                    <p className='font-bold text-white text-sm truncate'>
                      ID: {conv._id}
                    </p>
                    <p className='text-sm text-gray-400 truncate mt-1'>
                      Status: {conv.status}
                    </p>
                    <p className='text-xs text-gray-500 mt-2'>
                      {new Date(conv.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className='text-center text-gray-500 p-8'>
                  <p>{error || 'Percakapan tidak ditemukan.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className='lg:col-span-2 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
            {detailLoading ? (
              <div className='flex justify-center items-center h-full text-gray-500'>
                <Loader2 className='w-12 h-12 animate-spin' />
              </div>
            ) : selectedConversation ? (
              <>
                <header className='p-4 border-b border-neutral-700 flex justify-between items-center'>
                  <div>
                    <h3 className='font-bold text-white'>Detail Percakapan</h3>
                    <p className='text-sm text-gray-400'>
                      {selectedConversation._id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteChat(selectedConversation._id)}
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
                      <div className={`p-2 rounded-full ${ msg.sender === 'user' ? 'bg-blue-600' : 'bg-neutral-600' }`} >
                        {msg.sender === 'user' ? ( <User className='w-4 h-4 text-white' /> ) : ( <Bot className='w-4 h-4 text-white' /> )}
                      </div>
                      <div className={`px-4 py-2 rounded-lg shadow-sm ${ msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-gray-200' }`} >
                        <p>{msg.msg}</p>
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
                  Pilih salah satu percakapan dari daftar di sebelah kiri untuk melihat detailnya.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}