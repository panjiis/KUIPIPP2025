// Admin/knowledge-view.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  DatabaseZap,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  ToggleLeft,
  ToggleRight,
  FileText,
  PlusCircle,
  Save,
  CornerDownLeft,
  Loader2,
  BookOpen,
  X,
  // --- IMPORT BARU ---
  Cloud,
  CloudOff,
  AlertCircle
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';

import { toast } from 'sonner';

// ===== INTERFACES =====
interface KnowledgeItem {
  _id: string;
  topic: string;
  content: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_sync: boolean; // <--- FIELD BARU
  updatedAt: string;
}

interface CategoryOption {
  label: string;
  value: string;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

interface KnowledgeListResponse {
  data: KnowledgeItem[];
}

interface SingleKnowledgeResponse {
  data: KnowledgeItem;
}

interface RagUpdateResponse {
  Message: string;
}

interface ErrorResponse {
  message: string;
}

interface KnowledgeDetailPanelProps {
  item: KnowledgeItem | null;
  mode: 'view' | 'edit' | 'add';
  onSave: (
    formData: Omit<KnowledgeItem, '_id' | 'updatedAt' | 'is_sync'>,
    isNew: boolean
  ) => void;
  onCancel: () => void;
  onEdit: () => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}

// ===== COMPONENTS HELPER =====

// 1. Komponen Modal Panduan Markdown
const MarkdownGuideModal = ({ onClose }: { onClose: () => void }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity'>
    <div className='bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200'>
      {/* Header Modal */}
      <div className='px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg'>
            <BookOpen className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h3 className='font-bold text-lg text-gray-900 dark:text-white leading-tight'>
              Panduan Format Teks
            </h3>
            <p className='text-xs text-gray-500 dark:text-neutral-400'>
              Cheat sheet penulisan Markdown
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className='p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-white'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Content Modal */}
      <div className='p-6 overflow-y-auto space-y-8 bg-white dark:bg-neutral-900'>
        {/* Tips Section */}
        <div className='bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex gap-3'>
          <div className='shrink-0 mt-0.5'>
            <div className='w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5'></div>
          </div>
          <div className='text-sm text-blue-800 dark:text-blue-200 leading-relaxed'>
            <span className='font-semibold block mb-1'>Tips Penting:</span>
            Agar chatbot dapat membaca format dengan rapi, pastikan Anda
            mengikuti simbol-simbol di bawah ini.
          </div>
        </div>

        {/* Gaya Teks Grid */}
        <div>
          <h4 className='text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-neutral-800 pb-2'>
            Gaya Teks
          </h4>
          <div className='grid grid-cols-2 gap-x-6 gap-y-4 text-sm'>
            {/* Header Kolom */}
            <div className='text-xs font-medium text-gray-400 dark:text-neutral-500 mb-[-8px]'>
              Ketik Ini (Input)
            </div>
            <div className='text-xs font-medium text-gray-400 dark:text-neutral-500 mb-[-8px]'>
              Hasil Tampilan
            </div>

            {/* Baris 1: Bold */}
            <code className='bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded-lg text-gray-800 dark:text-neutral-200 font-mono border border-gray-200 dark:border-neutral-700 flex items-center'>
              **Teks Tebal**
            </code>
            <div className='flex items-center px-3 py-2 text-gray-900 dark:text-white font-bold bg-gray-50/50 dark:bg-neutral-800/30 rounded-lg border border-transparent'>
              Teks Tebal
            </div>

            {/* Baris 2: Italic */}
            <code className='bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded-lg text-gray-800 dark:text-neutral-200 font-mono border border-gray-200 dark:border-neutral-700 flex items-center'>
              *Teks Miring*
            </code>
            <div className='flex items-center px-3 py-2 text-gray-900 dark:text-white italic bg-gray-50/50 dark:bg-neutral-800/30 rounded-lg border border-transparent'>
              Teks Miring
            </div>
          </div>
        </div>

        {/* Paragraf Section */}
        <div>
          <h4 className='text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-neutral-800 pb-2'>
            Paragraf & Baris Baru
          </h4>
          <div className='space-y-3 text-sm text-gray-600 dark:text-neutral-300'>
            <p>
              Untuk membuat{' '}
              <span className='font-semibold text-gray-900 dark:text-white'>
                Paragraf Baru
              </span>
              , tekan tombol{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-white font-mono text-xs border border-gray-300 dark:border-neutral-600'>
                Enter
              </kbd>{' '}
              sebanyak{' '}
              <span className='font-bold text-blue-600 dark:text-blue-400'>
                2 kali
              </span>
              .
            </p>

            {/* Visualisasi Enter */}
            <div className='bg-gray-50 dark:bg-neutral-950 p-4 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 font-mono text-xs leading-relaxed text-gray-500 dark:text-neutral-500 relative'>
              <span className='text-gray-900 dark:text-white'>
                Paragraf pertama disini.
              </span>
              <div className='flex items-center gap-2 my-1 opacity-40'>
                <CornerDownLeft className='w-3 h-3' />{' '}
                <span className='italic text-[10px]'>
                  (Enter 1: Baris kosong)
                </span>
              </div>
              <div className='flex items-center gap-2 mb-1 opacity-40'>
                <CornerDownLeft className='w-3 h-3' />{' '}
                <span className='italic text-[10px]'>
                  (Enter 2: Mulai baru)
                </span>
              </div>
              <span className='text-gray-900 dark:text-white'>
                Paragraf kedua dimulai disini.
              </span>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div>
          <h4 className='text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-neutral-800 pb-2'>
            Daftar (List)
          </h4>
          <div className='grid grid-cols-2 gap-4'>
            {/* Simbol */}
            <div className='space-y-2'>
              <span className='text-xs font-medium text-gray-500 dark:text-neutral-400 block text-center'>
                List Simbol
              </span>
              <div className='bg-gray-100 dark:bg-neutral-800 p-3 rounded-lg text-xs font-mono text-gray-800 dark:text-neutral-200 border border-gray-200 dark:border-neutral-700'>
                - Poin satu
                <br />
                - Poin dua
                <br />- Poin tiga
              </div>
            </div>
            {/* Angka */}
            <div className='space-y-2'>
              <span className='text-xs font-medium text-gray-500 dark:text-neutral-400 block text-center'>
                List Angka
              </span>
              <div className='bg-gray-100 dark:bg-neutral-800 p-3 rounded-lg text-xs font-mono text-gray-800 dark:text-neutral-200 border border-gray-200 dark:border-neutral-700'>
                1. Pertama
                <br />
                2. Kedua
                <br />
                3. Ketiga
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Modal */}
      <div className='p-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex justify-end'>
        <button
          onClick={onClose}
          className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all transform active:scale-95'
        >
          Saya Mengerti
        </button>
      </div>
    </div>
  </div>
);

// 2. Komponen Input Field Helper
const InputField = ({
  label,
  name,
  value,
  onChange,
  isEditing,
  type = 'text',
  rows = 5,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  isEditing: boolean;
  type?: string;
  rows?: number;
  placeholder?: string;
}) => (
  <div className='mb-4'>
    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
      {label}
    </label>
    {isEditing ? (
      type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          className='w-full bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-neutral-600'
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className='w-full bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-neutral-600'
        />
      )
    ) : (
      <div className='bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-200 dark:border-neutral-800 text-gray-800 dark:text-gray-200'>
        {value}
      </div>
    )}
  </div>
);

// ===== MAIN COMPONENT =====
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view');
  const [isLoading, setIsLoading] = useState({
    list: true,
    rag: false,
    save: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  

  // ===== FETCH DATA (Modified to handle silent updates) =====
  const fetchKnowledgeItems = useMemo(
    () =>
      async (silent = false) => {
        try {
          if (!silent) setIsLoading((prev) => ({ ...prev, list: true }));
          
          const res = await fetch('http://localhost:5000/api/knowledge', {
            credentials: 'include',
          });
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!res.ok) throw new Error('Gagal memuat data pengetahuan.');
          const data: KnowledgeListResponse = await res.json();
          
          setKnowledgeItems(data.data || []);
          
          if (!selectedItem && !silent && data.data && data.data.length > 0) {
            setSelectedItem(data.data[0]);
          }
          
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Terjadi kesalahan tidak diketahui.'
          );
        } finally {
          if (!silent) setIsLoading((prev) => ({ ...prev, list: false }));
        }
      },
    [selectedItem]
  );

  useEffect(() => {
    fetchKnowledgeItems();
  }, [fetchKnowledgeItems]);

  const downloadKnowledgeAsTxt = (items: KnowledgeItem[]) => {
    const content = items.map(item => (
      `TOPIC: ${item.topic}\n` +
      `CATEGORY: ${item.category}\n` +
      `STATUS: ${item.status}\n` +
      `CONTENT:\n${item.content}\n` +
      `--------------------------------------------------\n`
    )).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `knowledge-backup-${timestamp}.txt`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Di dalam knowledge-view.tsx
const handleUpdateRag = async () => {
  // --- TAMBAHKAN LOGIKA UNDUH DI SINI ---
  if (knowledgeItems.length > 0) {
    downloadKnowledgeAsTxt(knowledgeItems);
  } else {
    toast.error("Tidak ada data untuk diunduh.");
    return;
  }
  // --------------------------------------

  setIsLoading((prev) => ({ ...prev, rag: true }));
  try {
    const res = await fetch('http://localhost:8080/do-rag'); // Panggilan ke server AI
    if (!res.ok) throw new Error('Proses RAG gagal di server AI.');
    
    const data: RagUpdateResponse = await res.json();
    await fetchKnowledgeItems(true); // Refresh list

    toast.success('Update RAG Selesai & Data Berhasil Diunduh', {
      description: data.Message || 'Proses berhasil.',
    });
  } catch (err) {
    toast.error('Error saat update RAG', {
      description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
    });
  } finally {
    setIsLoading((prev) => ({ ...prev, rag: false }));
  }
};

  // ===== SAVE ITEM (Updated) =====
  const handleSaveItem = async (
    formData: Omit<KnowledgeItem, '_id' | 'updatedAt' | 'is_sync'>,
    isNew: boolean
  ) => {
    setIsLoading((prev) => ({ ...prev, save: true }));
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew
      ? 'http://localhost:5000/api/knowledge'
      : `http://localhost:5000/api/knowledge/${selectedItem?._id}`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData: ErrorResponse = await res.json();
        throw new Error(errData.message || 'Gagal menyimpan data.');
      }
      
      const { data: savedItem }: SingleKnowledgeResponse = await res.json();
      
      await fetchKnowledgeItems(true); 

      setSelectedItem(savedItem);
      
      toast.success(
        `Item "${savedItem.topic}" berhasil ${isNew ? 'dibuat' : 'diperbarui'}.`
      );
      setMode('view');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan tidak diketahui.'
      );
    } finally {
      setIsLoading((prev) => ({ ...prev, save: false }));
    }
  };

  // ===== TOGGLE STATUS (Updated) =====
  const handleToggleStatus = async (id: string) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/knowledge/${id}/status`,
        { method: 'PUT', credentials: 'include' }
      );
      if (!res.ok) throw new Error('Gagal mengubah status.');
      
      const { data: updatedItem }: SingleKnowledgeResponse = await res.json();
      
      await fetchKnowledgeItems(true);
      
      setSelectedItem(updatedItem);
      toast.success(
        `Status "${updatedItem.topic}" diubah menjadi ${updatedItem.status}`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan tidak diketahui.'
      );
    }
  };

  // ===== DELETE ITEM (Updated) =====
  const executeDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/knowledge/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal menghapus data.');
      
      await fetchKnowledgeItems(true);
      
      setSelectedItem(null);
      setMode('view');
      toast.success('Item berhasil dihapus.');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan tidak diketahui.'
      );
    }
  };

  const handleDeleteItem = (id: string) => {
    // Ambil data item yang sedang dipilih
    if (!selectedItem) return;

    // PENGECEKAN CLIENT-SIDE
    if (selectedItem.status !== 'INACTIVE' || !selectedItem.is_sync) {
      toast.error('Tidak Dapat Menghapus', {
        description: 'Item harus dinonaktifkan (INACTIVE) dan disinkronkan (Update RAG) terlebih dahulu sebelum dihapus.',
      });
      return;
    }

    // Jika syarat terpenuhi, tampilkan konfirmasi hapus
    toast('Konfirmasi Hapus', {
      description: `Yakin ingin menghapus "${selectedItem.topic}" secara permanen?`,
      action: {
        label: 'Ya, Hapus',
        onClick: () => executeDeleteItem(id),
      },
      cancel: {
        label: 'Batal',
        onClick: () => {},
      },
      duration: 8000,
    });
  };

  // ===== HANDLERS =====
  const handleSelectItem = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setMode('view');
  };
  const handleAddInfoClick = () => {
    setSelectedItem(null);
    setMode('add');
  };
  const handleCancelAction = () => {
    if (mode === 'add' && knowledgeItems.length > 0)
      setSelectedItem(knowledgeItems[0]);
    setMode('view');
  };
  const handleEditClick = () => setMode('edit');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return knowledgeItems;
    return knowledgeItems.filter(
      (item) =>
        item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [knowledgeItems, searchQuery]);

  // ===== UI RENDER =====
  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col'>
      {/* HEADER */}
      <header className='mb-8 flex justify-between items-start'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>
            Knowledge Base
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            Manajemen dan monitoring Basis Pengetahuan chatbot.
          </p>
        </div>
        <button
          onClick={onBack}
          className='flex items-center gap-2 py-2 px-4 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors'
        >
          <CornerDownLeft className='w-4 h-4' />
          <span>Kembali ke History</span>
        </button>
      </header>

      {/* QUICK ACTIONS */}
      <section className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
        <div className='bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Update RAG
            </h2>
            <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
              Perbarui model dengan data terbaru (Wajib jika ada perubahan).
            </p>
          </div>
          <button
            onClick={handleUpdateRag}
            disabled={isLoading.rag}
            className='flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-700'
          >
            {isLoading.rag ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' />
                <span>Memperbarui...</span>
              </>
            ) : (
              <>
                <DatabaseZap className='w-5 h-5' />
                <span>Update RAG</span>
              </>
            )}
          </button>
        </div>

        <div className='bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Tambah Informasi
            </h2>
            <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
              Input item pengetahuan baru.
            </p>
          </div>
          <button
            onClick={handleAddInfoClick}
            className='flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors'
            disabled={mode !== 'view'}
          >
            <PlusCircle className='w-5 h-5' />
            <span>Add Info</span>
          </button>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 flex-1 pb-3'>
        {/* LIST */}
        <div className='lg:col-span-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-[600px] flex flex-col overflow-hidden'>
          <div className='p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50'>
            <h2 className='text-sm font-semibold flex items-center mb-3 gap-2 text-gray-700 dark:text-gray-200 uppercase tracking-wider'>
              <FileText className='w-4 h-4' /> Knowledge List
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Cari Judul, Kategori...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-white dark:bg-neutral-950 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-neutral-700 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors'
                disabled={mode !== 'view'}
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1 p-2 space-y-1'>
            {isLoading.list ? (
              <div className='flex justify-center items-center h-full text-gray-400'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleSelectItem(item)}
                  disabled={mode !== 'view'}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                    selectedItem?._id === item._id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className='flex justify-between items-center mb-1'>
                    <p className='font-bold text-gray-900 dark:text-white text-sm truncate w-[70%]'>
                      {item.topic}
                    </p>
                    {/* --- STATUS ICONS DI LIST --- */}
                    <div className="flex items-center gap-1.5">
                      {/* Sync Icon */}
                      {item.is_sync ? (
                        <Cloud className='w-3.5 h-3.5 text-blue-500' />
                      ) : (
                        <CloudOff className='w-3.5 h-3.5 text-orange-500' />
                      )}
                      
                      {/* Active Icon */}
                      {item.status === 'ACTIVE' ? (
                        <CheckCircle className='w-4 h-4 text-green-500' />
                      ) : (
                        <XCircle className='w-4 h-4 text-red-500' />
                      )}
                    </div>
                  </div>
                  <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                    {item.content}
                  </p>
                  <div className='flex items-center justify-between mt-1'>
                     <p className='text-[10px] text-gray-400 dark:text-gray-500'>
                      {item.category}
                    </p>
                    <p className='text-[10px] text-gray-400 dark:text-gray-500'>
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className='text-center text-gray-500 dark:text-gray-400 p-8 text-sm'>
                <p>{error || 'Item pengetahuan tidak ditemukan.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className='lg:col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-sm h-[600px] flex flex-col overflow-hidden'>
          <KnowledgeDetailPanel
            item={selectedItem}
            mode={mode}
            onSave={handleSaveItem}
            onCancel={handleCancelAction}
            onEdit={handleEditClick}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDeleteItem}
            isSaving={isLoading.save}
          />
        </div>
      </section>
    </div>
  );
}

// ===== DETAIL PANEL COMPONENT =====
const initialFormData = {
  topic: '',
  content: '',
  category: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
};

function KnowledgeDetailPanel({
  item,
  mode,
  onSave,
  onCancel,
  onEdit,
  onToggleStatus,
  onDelete,
  isSaving,
}: KnowledgeDetailPanelProps) {
  const isAdding = mode === 'add';
  const isEditing = mode === 'edit';
  const [formData, setFormData] = useState(initialFormData);
  const [showGuide, setShowGuide] = useState(false);
  
  // STATE BARU: Untuk menyimpan opsi kategori
  const [categoryOptions, setCategoryOptions] = useState<{label: string, value: string}[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // FETCH KATEGORI SAAT MODE EDIT/ADD
  useEffect(() => {
    if (isAdding || isEditing) {
      setIsLoadingCategories(true);
      fetch('http://localhost:5000/api/knowledge/categories')
        .then(res => res.json())
        .then(json => {
          if (!json.error && json.data) {
            // Tentukan tipe parameter cat secara eksplisit
            const options = json.data.map((cat: { name: string }) => ({
              label: cat.name,
              value: cat.name
            }));
            setCategoryOptions(options);
          }
        })
        .catch(err => console.error("Gagal load kategori:", err))
        .finally(() => setIsLoadingCategories(false));
    }
  }, [isAdding, isEditing]);

  useEffect(() => {
    if (item && !isAdding) {
      setFormData({
        topic: item.topic,
        content: item.content,
        category: item.category,
        status: item.status,
      });
    } else if (isAdding) {
      setFormData(initialFormData);
    }
  }, [item, mode, isAdding]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // HANDLER KHUSUS UNTUK CATEGORY SELECT
  const handleCategoryChange = (newValue: CategoryOption | null) => {
    setFormData(prev => ({ 
      ...prev, 
      category: newValue ? newValue.value : '' 
    }));
  };

  const handleSaveClick = () => {
    if (!formData.topic || !formData.content || !formData.category) {
      toast.warning('Judul, Konten, dan Kategori tidak boleh kosong.');
      return;
    }
    // is_sync tidak dikirim saat save, dihandle backend
    onSave(formData, isAdding);
  };

  if (!item && !isAdding) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-600'>
        <div className="p-6 bg-gray-50 dark:bg-neutral-800/50 rounded-full mb-4">
           <FileText className='w-10 h-10' />
        </div>
        <p>Pilih atau buat item pengetahuan untuk ditampilkan.</p>
      </div>
    );
  }

  // 5. Render Form Utama
  return (
    <>
      {showGuide && <MarkdownGuideModal onClose={() => setShowGuide(false)} />}

      <div className='flex flex-col h-full'>
        {/* --- HEADER PANEL --- */}
        <header className='p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/50'>
          <div>
            <h3 className='font-bold text-gray-900 dark:text-white'>
              {isAdding
                ? 'Tambah Informasi'
                : isEditing
                ? 'Edit Item'
                : item?.topic}
            </h3>
            {item && !isAdding && (
              <div className='flex items-center gap-2 mt-1'>
                <p className='text-xs text-gray-500 font-mono'>ID: {item._id}</p>
              </div>
            )}
          </div>
          <div className='flex flex-wrap gap-2'>
            {(isAdding || isEditing) && (
              <button
                type='button'
                onClick={() => setShowGuide(true)}
                className='px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-medium transition-colors'
                title='Lihat Panduan Format Teks'
              >
                Panduan
              </button>
            )}

            {isAdding || isEditing ? (
              <>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className='px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1'
                >
                  {isSaving ? <Loader2 className='w-3 h-3 animate-spin' /> : <Save className='w-3 h-3' />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
                <button
                  onClick={onCancel}
                  className='px-3 py-1.5 bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors flex items-center gap-1'
                >
                  <CornerDownLeft className='w-3 h-3' />
                  <span>Batal</span>
                </button>
              </>
            ) : (
              item && (
                <>
                  <button
                    onClick={() => onToggleStatus(item._id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      item.status === 'ACTIVE'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}
                  >
                    {item.status === 'ACTIVE' ? (
                      <>
                        <ToggleLeft className='w-3 h-3' />
                        <span>Nonaktifkan</span>
                      </>
                    ) : (
                      <>
                        <ToggleRight className='w-3 h-3' />
                        <span>Aktifkan</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={onEdit}
                    className='px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1'
                  >
                    <Pencil className='w-3 h-3' />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(item._id)}
                    className='px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1'
                  >
                    <Trash2 className='w-3 h-3' />
                    <span>Hapus</span>
                  </button>
                </>
              )
            )}
          </div>
        </header>

        {/* --- BODY PANEL --- */}
        <div className='flex-1 overflow-y-auto p-6 bg-white dark:bg-neutral-900 space-y-4'>
          
          {/* A. BADGES INFO (Status & Sync) */}
          {!isAdding && item && (
            <div className="flex flex-wrap gap-3 mb-4">
              {/* Status Badge */}
              <div
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  item.status === 'ACTIVE'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}
              >
                {item.status === 'ACTIVE' ? (
                  <CheckCircle className='w-4 h-4' />
                ) : (
                  <XCircle className='w-4 h-4' />
                )}
                <span>Status: {item.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}</span>
              </div>

              {/* Sync Badge */}
              <div
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  item.is_sync
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                }`}
              >
                {item.is_sync ? (
                  <Cloud className='w-4 h-4' />
                ) : (
                  <AlertCircle className='w-4 h-4' />
                )}
                <span>
                  Sync RAG: {item.is_sync ? 'Sudah (Synced)' : 'Belum (Tekan Update RAG)'}
                </span>
              </div>
            </div>
          )}
          
          {/* B. FORM INPUTS */}
            <InputField
              label='Judul/Topik'
              name='topic'
              value={formData.topic}
              onChange={handleChange}
              isEditing={isAdding || isEditing}
              placeholder='Contoh: Beasiswa DARMASISWA'
            />

            {/* C. KATEGORI (CREATABLE SELECT) */}
            <div className='mb-4'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Kategori
              </label>
              {(isAdding || isEditing) ? (
                <CreatableSelect
                  isClearable
                  isDisabled={isLoadingCategories}
                  isLoading={isLoadingCategories}
                  onChange={handleCategoryChange}
                  onCreateOption={(inputValue) => {
                    handleCategoryChange({ label: inputValue, value: inputValue });
                  }}
                  options={categoryOptions}
                  value={formData.category ? { label: formData.category, value: formData.category } : null}
                  placeholder="Pilih atau Ketik Kategori Baru..."
                  
                  // --- PERUBAHAN DI SINI: MENGGUNAKAN classNames + Tailwind ---
                  classNames={{
                    control: (state) =>
                      `!bg-white dark:!bg-neutral-950 !border-gray-200 dark:!border-neutral-700 !rounded-lg !text-sm !shadow-none !p-1.5 ${
                        state.isFocused ? '!ring-2 !ring-blue-500 !border-transparent' : ''
                      }`,
                    menu: () => 
                      '!bg-white dark:!bg-neutral-900 !border !border-gray-200 dark:!border-neutral-700 !rounded-lg !mt-1',
                    option: (state) =>
                      `!cursor-pointer !text-sm ${
                        state.isFocused
                          ? '!bg-blue-50 dark:!bg-blue-900/30 !text-blue-700 dark:!text-blue-200'
                          : '!bg-white dark:!bg-neutral-900 !text-gray-900 dark:!text-white'
                      }`,
                    singleValue: () => '!text-gray-900 dark:!text-white',
                    input: () => '!text-gray-900 dark:!text-white',
                    placeholder: () => '!text-gray-400 dark:!text-neutral-600',
                  }}
                />
              ) : (
                <div className='bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-200 dark:border-neutral-800 text-gray-800 dark:text-gray-200'>
                  {formData.category}
                </div>
              )}
            </div>

            {/* D. KONTEN AREA */}
            <div className='relative'>
              <InputField
                label='Konten Pengetahuan'
                name='content'
                value={formData.content}
                onChange={handleChange}
                isEditing={isAdding || isEditing}
                type='textarea'
                rows={15}
                placeholder='Gunakan format Markdown: **Tebal**, - Poin, dsb.'
              />
              {(isAdding || isEditing) && (
                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1 flex justify-end'>
                  * Tekan tombol &quot;Panduan&quot; di atas untuk bantuan format.
                </div>
              )}
            </div>
          
          {/* E. FOOTER INFO */}
          {item && !isAdding && (
            <div className='mt-4 text-xs text-gray-400 dark:text-gray-500 flex justify-between'>
              <span>Terakhir Diperbarui: {new Date(item.updatedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}