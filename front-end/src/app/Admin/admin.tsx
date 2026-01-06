// Admin/admin.tsx
'use client';
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Trash2,
  User,
  Search,
  Bot,
  Loader2,
  LogOut,
  UserPlus,
  DatabaseZap,
  ChevronsLeft,
  UploadCloud,
  Settings, // Icon Settings
} from 'lucide-react';
import { toast } from 'sonner';

// --- LIBRARY MARKDOWN & HTML PARSER ---
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'; // <--- PLUGIN PENTING UNTUK RENDER HTML

// --- IMPORT SUB-VIEWS ---
// Pastikan file-file ini ada di folder yang sama (Admin/)
import KnowledgeView from './knowledge-view';
import ManageAdminView from './manage-admin-view';
import RagDetailView from './rag-detail-view';
import SettingsView from './settings-view'; 

// --- INTERFACES ---
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

interface BackendMessage {
  sender: 'USER' | 'BOT';
  msg: string;
  createdAt: string;
}

interface SelectedConversation {
  _id: string;
  status: string;
  messages: Message[];
}

interface ChatListResponse {
  data: ChatSession[];
}

interface ChatHistoryResponse {
  data: BackendMessage[];
}

interface DeleteOldChatsResponse {
  message: string;
}

// Tipe untuk Navigasi
type ActiveView =
  | 'history'
  | 'knowledge'
  | 'manageAdmin'
  | 'ragUpload'
  | 'settings';

// ============================================================================
// KOMPONEN 1: SIDEBAR (Navigasi)
// ============================================================================
const AdminSidebar = ({
  activeView,
  onNavClick,
  onLogout,
  isLoggingOut,
  userRole,
}: {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  userRole: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Daftar Menu Dasar (Muncul untuk SEMUA Admin)
  const navItems = [
    {
      view: 'history' as ActiveView,
      icon: MessageSquare,
      label: 'Chat History',
    },
    {
      view: 'knowledge' as ActiveView,
      icon: DatabaseZap,
      label: 'Knowledge Base',
    },
    {
      view: 'ragUpload' as ActiveView,
      icon: UploadCloud,
      label: 'Upload & Auto-RAG',
    },
    { view: 'settings' as ActiveView, icon: Settings, label: 'Settings' },
  ];

  // LOGIC SUPER ADMIN: Tambahkan menu 'Manage Admin'
  if (userRole === 'SUPER_ADMIN') {
    navItems.splice(3, 0, {
      view: 'manageAdmin' as ActiveView,
      icon: UserPlus,
      label: 'Manage Admin',
    });
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800
                 transition-all duration-300 ease-in-out overflow-hidden z-20
                 ${isOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Header Sidebar */}
      <div className='flex items-center h-16 px-6 border-b border-gray-100 dark:border-neutral-800 mb-4'>
        {isOpen ? (
          <h1 className='text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap'>
            Admin Panel
          </h1>
        ) : (
          <ChevronsLeft className='w-6 h-6 text-gray-500 dark:text-gray-400 mx-auto' />
        )}
      </div>

      {/* Menu Items */}
      <nav className='flex-1 flex flex-col gap-1 px-3'>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavClick(item.view)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${!isOpen && 'justify-center'} 
                      ${
                        activeView === item.view
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
          >
            <item.icon
              className={`w-5 h-5 flex-shrink-0 ${
                activeView === item.view
                  ? 'text-blue-600 dark:text-blue-400'
                  : ''
              }`}
            />
            {isOpen && <span className='whitespace-nowrap'>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer Section: Logout */}
      <div className='p-3 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50'>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium 
                    text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 
                    transition-colors disabled:opacity-50
                    ${!isOpen && 'justify-center'}`}
        >
          {isLoggingOut ? (
            <Loader2 className='w-5 h-5 animate-spin flex-shrink-0' />
          ) : (
            <LogOut className='w-5 h-5 flex-shrink-0' />
          )}
          {isOpen && (
            <span className='whitespace-nowrap'>
              {isLoggingOut ? 'Keluar...' : 'Keluar'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

// ============================================================================
// KOMPONEN 2: CHAT HISTORY VIEW (UPDATED)
// ============================================================================
const ChatHistoryView = () => {
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SelectedConversation | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch List
  const fetchChatList = async () => {
    try {
      setListLoading(true);
      const res = await fetch('http://localhost:5000/api/admin/chats/all', {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Gagal mengambil daftar chat.');
      const data: ChatListResponse = await res.json();
      setChatList(data.data || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchChatList();
  }, []);

  // 2. Select Conversation & Fetch Details
  const handleSelectConversation = async (chatId: string) => {
    try {
      setDetailLoading(true);
      setSelectedConversation(null);

      const res = await fetch(
        `http://localhost:5000/api/admin/chats/history?chatId=${chatId}`,
        { credentials: 'include' }
      );

      let transformedMessages: Message[] = [];
      let status = 'UNKNOWN';

      if (res.ok) {
        const data: ChatHistoryResponse = await res.json();
        transformedMessages = (data.data || []).map(
          (msg: BackendMessage): Message => ({
            msg: msg.msg,
            createdAt: msg.createdAt,
            sender: msg.sender === 'USER' ? 'user' : 'bot',
          })
        );
        transformedMessages.reverse();
      } else {
        console.warn('Gagal fetch detail, mungkin chat kosong.');
      }

      const currentChat = chatList.find((chat) => chat._id === chatId);
      status = currentChat?.status || 'UNKNOWN';

      setSelectedConversation({
        _id: chatId,
        status: status,
        messages: transformedMessages,
      });
    } catch (err) {
      setSelectedConversation({
        _id: chatId,
        status: 'ERROR',
        messages: [],
      });

      if (err instanceof Error) {
        toast.error(`Gagal memuat detail: ${err.message}`);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // 3. Delete Single Chat
  const executeDeleteChat = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/chats/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Gagal menghapus chat.');

      setChatList((prev) => prev.filter((c) => c._id !== id));

      if (selectedConversation?._id === id) {
        setSelectedConversation(null);
      }

      toast.success('Percakapan berhasil dihapus.');
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error: ${err.message}`);
      } else {
        toast.error('Gagal menghapus chat.');
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    if (
      confirm(
        'Apakah Anda yakin ingin menghapus percakapan ini secara permanen?'
      )
    ) {
      executeDeleteChat(id);
    }
  };

  // 4. Delete Old Chats
  const executeDeleteOldChats = async () => {
    try {
      const res = await fetch(
        'http://localhost:5000/api/admin/chats/delete-old',
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok) throw new Error('Gagal menghapus chat lama.');
      const result: DeleteOldChatsResponse = await res.json();
      toast.success(result.message);
      fetchChatList();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error: ${err.message}`);
      } else {
        toast.error('Gagal membersihkan chat lama.');
      }
    }
  };

  const handleDeleteOldChats = async () => {
    if (confirm('Hapus semua chat lama (NONACTIVE > 7 hari)?')) {
      executeDeleteOldChats();
    }
  };

  const filteredConversations = chatList.filter((conv) =>
    conv._id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col'>
      {/* Header View */}
      <header className='mb-8 flex justify-between items-start'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>
            Chat History
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            Manajemen dan monitoring aktivitas chatbot.
          </p>
        </div>
        <button
          onClick={handleDeleteOldChats}
          className='flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors'
        >
          <Trash2 className='w-5 h-5' />
          <span>Hapus Chat Lama</span>
        </button>
      </header>

      {/* Chat History Section */}
      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1'>
        {/* List */}
        <div className='lg:col-span-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-[800px] flex flex-col overflow-hidden'>
          <div className='p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50'>
            <h2 className='text-sm font-semibold flex items-center mb-3 gap-2 text-gray-700 dark:text-gray-200 uppercase tracking-wider'>
              <MessageSquare className='w-4 h-4' /> Daftar Percakapan
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Cari ID percakapan...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-white dark:bg-neutral-950 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-neutral-700 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all'
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1 p-2 space-y-1'>
            {listLoading ? (
              <div className='flex justify-center items-center h-full text-gray-400'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <div
                  key={conv._id}
                  className={`group relative w-full rounded-lg transition-all border ${
                    selectedConversation?._id === conv._id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {/* Area Klik Utama untuk Select */}
                  <div
                    onClick={() => handleSelectConversation(conv._id)}
                    className='p-3 cursor-pointer w-full text-left pr-10'
                  >
                    <div className='flex justify-between items-start mb-1'>
                      <p className='font-mono text-xs text-gray-500 dark:text-gray-400 truncate w-24'>
                        {conv._id.substring(0, 8)}...
                      </p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          conv.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <p className='text-xs text-gray-400 dark:text-gray-500 mb-1'>
                      {new Date(conv.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Tombol Hapus */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(conv._id);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md 
                               text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30
                               opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                               ${
                                 selectedConversation?._id === conv._id
                                   ? 'opacity-100'
                                   : ''
                               }`}
                    title='Hapus Percakapan'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              ))
            ) : (
              <div className='text-center text-gray-500 dark:text-gray-400 p-8 text-sm'>
                <p>{error || 'Tidak ada percakapan ditemukan.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className='lg:col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-[800px] flex flex-col overflow-hidden'>
          {detailLoading ? (
            <div className='flex justify-center items-center h-full text-gray-400'>
              <Loader2 className='w-12 h-12 animate-spin' />
            </div>
          ) : selectedConversation ? (
            <>
              <header className='p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/50'>
                <div>
                  <h3 className='font-bold text-gray-900 dark:text-white'>
                    Detail Percakapan
                  </h3>
                  <p className='text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5'>
                    ID: {selectedConversation._id}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteChat(selectedConversation._id)}
                  className='flex items-center gap-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'
                >
                  <Trash2 className='w-4 h-4' />
                  <span>Hapus</span>
                </button>
              </header>
              <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-white dark:bg-neutral-900'>
                {selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 max-w-[90%] ${
                        msg.sender === 'user'
                          ? 'self-end flex-row-reverse'
                          : 'self-start'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {msg.sender === 'user' ? (
                          <User className='w-4 h-4' />
                        ) : (
                          <Bot className='w-4 h-4' />
                        )}
                      </div>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-neutral-700'
                        }`}
                      >
                        {/* --- RENDERER MARKDOWN + HTML TABLE --- */}
                        <div
                          className={`prose prose-sm max-w-none ${
                            msg.sender === 'user'
                              ? 'prose-invert'
                              : 'dark:prose-invert'
                          } text-sm`}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]} // KUNCI: Render HTML Table dari AI
                            components={{
                              // Table Styling untuk Admin View
                              table: ({ ...props }) => (
                                <div className='overflow-x-auto my-3 border border-gray-200 dark:border-gray-700 rounded-lg'>
                                  <table
                                    className='min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-xs'
                                    {...props}
                                  />
                                </div>
                              ),
                              thead: ({ ...props }) => (
                                <thead
                                  className='bg-gray-50 dark:bg-gray-800'
                                  {...props}
                                />
                              ),
                              th: ({ ...props }) => (
                                <th
                                  className='px-3 py-2 font-bold text-gray-700 dark:text-gray-200 border-b'
                                  {...props}
                                />
                              ),
                              tbody: ({ ...props }) => (
                                <tbody
                                  className='bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-gray-700'
                                  {...props}
                                />
                              ),
                              tr: ({ ...props }) => (
                                <tr
                                  className='hover:bg-gray-50 dark:hover:bg-neutral-800/50'
                                  {...props}
                                />
                              ),
                              td: ({ ...props }) => (
                                <td
                                  className='px-3 py-2 border-r border-gray-100 dark:border-gray-800 last:border-r-0 whitespace-pre-wrap align-top'
                                  {...props}
                                />
                              ),
                              ul: ({ ...props }) => (
                                <ul
                                  className='list-disc pl-4 mb-2 space-y-1'
                                  {...props}
                                />
                              ),
                              ol: ({ ...props }) => (
                                <ol
                                  className='list-decimal pl-4 mb-2 space-y-1'
                                  {...props}
                                />
                              ),
                              h3: ({ ...props }) => (
                                <h3
                                  className='font-bold text-base mt-4 mb-2 text-blue-600 dark:text-blue-400'
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {msg.msg}
                          </ReactMarkdown>
                        </div>

                        <p
                          className={`text-[10px] mt-2 opacity-70 ${
                            msg.sender === 'user'
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='flex flex-col items-center justify-center h-full text-gray-400'>
                    <DatabaseZap className='w-12 h-12 mb-2 opacity-20' />
                    <p className='text-sm'>Data percakapan kosong.</p>
                    <p className='text-xs'>
                      Anda bisa menghapus percakapan ini melalui tombol di atas.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className='flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-600'>
              <div className='p-6 bg-gray-50 dark:bg-neutral-800/50 rounded-full mb-4'>
                <MessageSquare className='w-10 h-10' />
              </div>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                Belum ada percakapan dipilih
              </h3>
              <p className='text-sm mt-1'>
                Pilih salah satu dari daftar di sebelah kiri.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// KOMPONEN UTAMA: ADMIN DASHBOARD
// ============================================================================
export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('history');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 1. Ambil Role saat mount
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    setUserRole(storedRole);
  }, []);

  // 2. Logic Logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Proses logout gagal.');

      localStorage.removeItem('role');
      window.location.href = '/login';
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Error saat logout: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat logout.');
      }
      setIsLoggingOut(false);
    }
  };

  // 3. Render View Controller
  const renderView = () => {
    switch (activeView) {
      case 'history':
        return <ChatHistoryView />;
      case 'knowledge':
        return <KnowledgeView onBack={() => setActiveView('history')} />;
      case 'ragUpload':
        return (
          <RagDetailView
            onBack={() => setActiveView('knowledge')}
            onSuccess={() => setActiveView('knowledge')}
          />
        );
      case 'manageAdmin':
        return userRole === 'SUPER_ADMIN' ? (
          <ManageAdminView onBack={() => setActiveView('history')} />
        ) : (
          <ChatHistoryView />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatHistoryView />;
    }
  };

  return (
    <div className='flex h-screen bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-200 font-sans transition-colors duration-300'>
      <AdminSidebar
        activeView={activeView}
        onNavClick={setActiveView}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        userRole={userRole}
      />
      <main className='flex-1 overflow-y-auto h-screen relative'>
        {renderView()}
      </main>
    </div>
  );
}