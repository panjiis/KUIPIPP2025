'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
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
  Loader2, // <-- Impor ikon untuk loading
} from 'lucide-react';

// --- (INTERFACE DISESUAIKAN DENGAN BACKEND) ---
interface KnowledgeItem {
  _id: string;
  topic: string;
  content: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

// Komponen InputField tidak berubah
const InputField = ({ label, name, value, onChange, isEditing, type = 'text', rows = 5 }: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isEditing: boolean;
  type?: string;
  rows?: number;
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label}
    </label>
    {isEditing ? (
      type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          className="w-full bg-neutral-900 border border-neutral-600 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-neutral-900 border border-neutral-600 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
      )
    ) : (
      <div className="bg-neutral-700/50 p-3 rounded-lg text-sm whitespace-pre-wrap">
        {value}
      </div>
    )}
  </div>
);

const KnowledgeDetailForm = ({ item, mode, onSave, onCancel, onToggleStatus, onDelete, isSaving }: any) => {
  // ... (kode komponen KnowledgeDetailForm juga perlu disesuaikan di dalam komponen utama)
};

// --- (KOMPONEN UTAMA: KNOWLEDGE VIEW) ---
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view');

  const [isLoading, setIsLoading] = useState({ list: true, rag: false, save: false });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. FUNGSI UNTUK MENGAMBIL SEMUA DATA DARI BACKEND
  const fetchKnowledgeItems = async () => {
    try {
      setIsLoading(prev => ({ ...prev, list: true }));
      const res = await fetch('http://localhost:5000/api/knowledge', { credentials: 'include' });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Gagal memuat data pengetahuan.');

      const data = await res.json();
      setKnowledgeItems(data.data || []);
      // Pilih item pertama secara default setelah memuat
      if (data.data && data.data.length > 0) {
        setSelectedItem(data.data[0]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, list: false }));
    }
  };

  useEffect(() => {
    fetchKnowledgeItems();
  }, []);

  // 2. FUNGSI UNTUK MEMANGGIL API UPDATE RAG
  const handleUpdateRag = async () => {
    setIsLoading(prev => ({ ...prev, rag: true }));
    try {
      const res = await fetch('http://localhost:8080/do-rag'); // <-- Target server Python
      if (!res.ok) throw new Error('Proses RAG gagal di server AI.');
      const data = await res.json();
      alert(`Update RAG Selesai: ${data.Message || 'Proses berhasil.'}`);
    } catch (err: any) {
      alert(`Error saat update RAG: ${err.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, rag: false }));
    }
  };

  // 3. FUNGSI UNTUK MENYIMPAN (CREATE/UPDATE)
  const handleSaveItem = async (formData: Omit<KnowledgeItem, '_id' | 'updatedAt'>, isNew: boolean) => {
    setIsLoading(prev => ({ ...prev, save: true }));
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? 'http://localhost:5000/api/knowledge' : `http://localhost:5000/api/knowledge/${selectedItem?._id}`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Gagal menyimpan data.');
      }

      const { data: savedItem } = await res.json();
      
      if (isNew) {
        setKnowledgeItems(prev => [savedItem, ...prev]);
        setSelectedItem(savedItem);
      } else {
        setKnowledgeItems(prev => prev.map(item => item._id === savedItem._id ? savedItem : item));
        setSelectedItem(savedItem);
      }
      setMode('view');

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, save: false }));
    }
  };

  // 4. FUNGSI UNTUK MENGHAPUS
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/knowledge/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal menghapus data.');
      
      // Update UI
      setKnowledgeItems(prev => prev.filter(item => item._id !== id));
      setSelectedItem(null);
      setMode('view');
      alert('Item berhasil dihapus.');

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // 5. FUNGSI UNTUK TOGGLE STATUS
  const handleToggleStatus = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/knowledge/${id}/status`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal mengubah status.');

      const { data: updatedItem } = await res.json();
      
      // Update UI
      setKnowledgeItems(prev => prev.map(item => item._id === updatedItem._id ? updatedItem : item));
      setSelectedItem(updatedItem);

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Handler UI lainnya
  const handleSelectItem = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setMode('view');
  };
  const handleAddInfoClick = () => {
    setSelectedItem(null);
    setMode('add');
  };
  const handleCancelAction = () => {
    if (mode === 'add') {
      setSelectedItem(knowledgeItems.length > 0 ? knowledgeItems[0] : null);
    }
    setMode('view');
  };
  const handleEditClick = () => {
    setMode('edit');
  };

  const filteredItems = useMemo(() => {
    return knowledgeItems.filter(
      (item) =>
        item._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [knowledgeItems, searchQuery]);

  // (Sisa kode JSX sama, tapi dihubungkan ke fungsi-fungsi baru di atas)
  return (
    <div className='bg-gray-900 min-h-screen text-gray-200 font-sans p-4 sm:p-6 lg:p-8'>
       <div className='max-w-7xl mx-auto'>
         {/* Header */}
         <header className='mb-8'>
           <h1 className='text-3xl font-bold text-white tracking-tight'>
             Admin Dashboard - Knowledge View
           </h1>
           <p className='text-gray-400 mt-1'>
             Manajemen dan monitoring **Knowledge Base** (Basis Pengetahuan) chatbot.
           </p>
         </header>
 
         {/* Quick Actions */}
         <section className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
           <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
             <div><h2 className='text-lg font-semibold text-white'>History View</h2><p className='text-sm text-gray-400 mt-1'>Riwayat percakapan user</p></div>
             <button onClick={onBack} className='flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg'><RefreshCw className='w-5 h-5' /><span>History</span></button>
           </div>
           <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
             <div><h2 className='text-lg font-semibold text-white'>Update RAG</h2><p className='text-sm text-gray-400 mt-1'>Perbarui model dengan data terbaru.</p></div>
             <button onClick={handleUpdateRag} disabled={isLoading.rag} className='flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-lg disabled:bg-neutral-600'>
               {isLoading.rag ? <><Loader2 className='w-5 h-5 animate-spin' /><span>Memperbarui...</span></> : <><DatabaseZap className='w-5 h-5' /><span>Update RAG</span></>}
             </button>
           </div>
           <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
             <div><h2 className='text-lg font-semibold text-white'>Tambah Informasi</h2><p className='text-sm text-gray-400 mt-1'>Input item pengetahuan baru.</p></div>
             <button onClick={handleAddInfoClick} className='flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg' disabled={mode !== 'view'}>
               <PlusCircle className='w-5 h-5' /><span>Add Info</span>
             </button>
           </div>
         </section>
 
         {/* Knowledge Base Section */}
         <section className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
           {/* List */}
           <div className='lg:col-span-1 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
             <div className='p-4 border-b border-neutral-700'><h2 className='text-lg font-semibold flex items-center mb-4 gap-2'><FileText /> Knowledge Item List</h2>
               <div className='relative'>
                 <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
                 <input type='text' placeholder='Cari ID, Judul, atau Konten...' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className='w-full bg-neutral-900 text-gray-200 rounded-lg border border-neutral-600 pl-10 pr-4 py-2 text-sm' disabled={mode !== 'view'} />
               </div>
             </div>
             <div className='overflow-y-auto flex-1'>
               {isLoading.list ? <div className='flex justify-center items-center h-full'><Loader2 className='w-8 h-8 animate-spin' /></div> :
                 filteredItems.length > 0 ? (
                   filteredItems.map((item) => (
                     <button key={item._id} onClick={() => handleSelectItem(item)} disabled={mode !== 'view'} className={`w-full text-left p-4 border-l-4 ${selectedItem?._id === item._id && mode !== 'add' ? 'bg-blue-600/20 border-blue-500' : 'border-transparent'}`}>
                       <div className='flex justify-between items-center'><p className='font-bold text-white text-sm truncate'>{item.topic}</p>{item.status === 'ACTIVE' ? <CheckCircle className='w-4 h-4 text-green-400' /> : <XCircle className='w-4 h-4 text-red-400' />}</div>
                       <p className='text-sm text-gray-400 truncate mt-1'>{item.content}</p>
                       <p className='text-xs text-gray-500 mt-2'>Update: {new Date(item.updatedAt).toLocaleString()}</p>
                     </button>
                   ))
                 ) : <div className='text-center text-gray-500 p-8'><p>{error || 'Item pengetahuan tidak ditemukan.'}</p></div>
               }
             </div>
           </div>
           {/* Detail */}
           <div className='lg:col-span-2 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
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
     </div>
  );
}

// Komponen Panel Detail terpisah untuk kebersihan kode
function KnowledgeDetailPanel({ item, mode, onSave, onCancel, onEdit, onToggleStatus, onDelete, isSaving }: any) {
  const isAdding = mode === 'add';
  const isEditing = mode === 'edit';

  const initialFormData = {
    topic: '',
    content: '',
    category: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  };

  const [formData, setFormData] = useState(initialFormData);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSaveClick = () => {
    if (!formData.topic || !formData.content || !formData.category) {
      alert('Judul, Konten, dan Kategori tidak boleh kosong.');
      return;
    }
    onSave(formData, isAdding);
  };

  if (!item && !isAdding) {
    return <div className='flex flex-col items-center justify-center h-full text-gray-500'><FileText className='w-16 h-16 mb-4' /><h3 className='text-xl font-semibold'>Pilih Item</h3><p>Pilih item dari daftar untuk melihat detail.</p></div>;
  }
  
  return (
    <div className="flex flex-col h-full">
      <header className='p-4 border-b border-neutral-700 flex justify-between items-center'>
        <div>
          <h3 className='font-bold text-white'>{isAdding ? 'Tambah Informasi Baru' : (isEditing ? 'Edit Item' : 'Detail Item')}</h3>
          {item && !isAdding && <p className='text-xs text-gray-500'>ID: {item._id}</p>}
        </div>
        <div className="flex gap-2">
          {isAdding || isEditing ? (
            <>
              <button onClick={handleSaveClick} disabled={isSaving} className='flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-3 py-2 rounded-lg disabled:bg-neutral-600'>
                {isSaving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
              <button onClick={onCancel} className='flex items-center gap-2 bg-neutral-600 hover:bg-neutral-500 text-white font-semibold px-3 py-2 rounded-lg'>
                <CornerDownLeft className='w-4 h-4' /><span>Batal</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onToggleStatus(item?._id)} className={`flex items-center gap-2 font-semibold px-3 py-2 rounded-lg ${item?.status === 'ACTIVE' ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}>
                {item?.status === 'ACTIVE' ? <><ToggleLeft className='w-4 h-4' /><span>Nonaktifkan</span></> : <><ToggleRight className='w-4 h-4' /><span>Aktifkan</span></>}
              </button>
              <button onClick={onEdit} className='flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg'>
                <Pencil className='w-4 h-4' /><span>Edit</span>
              </button>
              <button onClick={() => onDelete(item?._id)} className='flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-2 rounded-lg'>
                <Trash2 className='w-4 h-4' /><span>Hapus</span>
              </button>
            </>
          )}
        </div>
      </header>
      <div className='flex-1 overflow-y-auto p-6'>
        {!isAdding && <div className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${item?.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
          {item?.status === 'ACTIVE' ? <CheckCircle className='w-4 h-4' /> : <XCircle className='w-4 h-4' />}
          Status: {item?.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}
        </div>}
        
        <div className="space-y-4">
            <InputField label="Judul/Topik" name="topic" value={formData.topic} onChange={handleChange} isEditing={isAdding || isEditing} />
            <InputField label="Kategori" name="category" value={formData.category} onChange={handleChange} isEditing={isAdding || isEditing} />
            <InputField label="Konten Pengetahuan" name="content" value={formData.content} onChange={handleChange} isEditing={isAdding || isEditing} type="textarea" />
        </div>
        
        {item && !isAdding && <div className="mt-4 text-xs text-gray-500">Terakhir Diperbarui: {new Date(item.updatedAt).toLocaleString()}</div>}
      </div>
    </div>
  );
}