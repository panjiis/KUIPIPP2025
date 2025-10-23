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
} from 'lucide-react';

// --- (INTERFACE AND MOCK DATA) ---
interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isActive: boolean;
  lastUpdated: string;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: 'doc-001',
    title: 'Jadwal dan Syarat Pendaftaran KKN',
    content:
      'Pendaftaran KKN dibuka mulai tanggal 1 November 2025. Syarat-syarat meliputi telah menempuh 100 SKS, IPK minimal 2.75, dan melengkapi formulir pendaftaran di website kemahasiswaan.',
    category: 'Akademik',
    isActive: true,
    lastUpdated: '2025-10-16T10:30:00Z',
  },
  {
    id: 'doc-002',
    title: 'Prosedur Pengajuan Surat Pengantar Magang',
    content:
      'Mahasiswa wajib mengisi formulir online di UNPAD, melampirkan transkrip nilai, dan menunggu proses verifikasi selama 3 hari kerja. Dokumen dapat diambil di TU setelah menerima notifikasi.',
    category: 'Administrasi',
    isActive: false,
    lastUpdated: '2025-10-16T09:15:00Z',
  },
  {
    id: 'doc-003',
    title: 'Informasi Gangguan Sistem SIAKAD',
    content:
      'Telah terjadi gangguan pada sistem SIAKAD pada tanggal 15 Oktober 2025 pukul 13:00-15:00. Gangguan telah diatasi. Mohon laporkan jika masih mengalami kendala dengan melampirkan screenshot.',
    category: 'Teknis',
    isActive: true,
    lastUpdated: '2025-10-15T14:00:00Z',
  },
];
// --- (AKHIR MOCK DATA) ---

// --- (SHARED INPUT FIELD COMPONENT) ---
const InputField = ({ label, name, value, onChange, isEditing, type = 'text', rows = 5 }: {
  label: string;
  name: keyof Omit<KnowledgeItem, 'id' | 'lastUpdated'>;
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



const KnowledgeDetailForm = ({
  item,
  mode,
  onSave,
  onCancel,
  onToggleStatus,
  onDelete
}: {
  item: KnowledgeItem | null; 
  mode: 'view' | 'edit' | 'add';
  onSave: (updatedItem: KnowledgeItem, isNew: boolean) => void;
  onCancel: () => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const isEditing = mode === 'edit';
  const isAdding = mode === 'add';

  const initialFormData: KnowledgeItem = item || {
    id: '',
    title: '',
    content: '',
    category: '',
    isActive: true,
    lastUpdated: new Date().toISOString(),
  };

  const [formData, setFormData] = useState<KnowledgeItem>(initialFormData);

 
  useEffect(() => {
    if (item && !isAdding) {
      setFormData(item);
    } else if (isAdding) {
      setFormData(initialFormData);
    }
  }, [item, mode]); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    } as KnowledgeItem));
  };

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      alert('Judul dan Konten tidak boleh kosong.');
      return;
    }

    const  updatedItem = { ...formData };
    const isNew = isAdding;

    if (isNew) {
      // Generate ID for new item
      updatedItem.id = `doc-${Math.random().toString(36).substring(2, 9)}`;
    }
    updatedItem.lastUpdated = new Date().toISOString();

    onSave(updatedItem, isNew);
    if (!isNew) onCancel(); 
  };

  const handleToggle = () => {
    if (item) {
      onToggleStatus(item.id);
    }
  };

  if (!item && mode === 'view') {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-500'>
        <FileText className='w-16 h-16 mb-4' />
        <h3 className='text-xl font-semibold'>Pilih Knowledge Item</h3>
        <p>Pilih salah satu item pengetahuan dari daftar di sebelah kiri.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
   
      <header className='p-4 border-b border-neutral-700 flex justify-between items-center flex-wrap gap-2 flex-shrink-0'>
        <div>
          <h3 className='font-bold text-white flex items-center gap-2'>
            <FileText className='w-5 h-5' />
            {isAdding ? 'Tambah Informasi Baru' : (isEditing ? 'Edit Item' : 'Detail Item')}
          </h3>
          {item && !isAdding && (
            <p className='text-xs text-gray-500'>ID: {item.id} | Kategori: {item.category}</p>
          )}
        </div>
        <div className="flex gap-3">
      
          {(isEditing || isAdding) ? (
            <>
      
              <button
                onClick={handleSave}
                className='flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-3 py-2 rounded-lg transition-colors duration-300'
              >
                <Save className='w-4 h-4' />
                <span>Save Item</span>
              </button>
           
              <button
                onClick={onCancel}
                className='flex items-center gap-2 bg-neutral-600 hover:bg-neutral-500 text-white font-semibold px-3 py-2 rounded-lg transition-colors duration-300'
              >
                <CornerDownLeft className='w-4 h-4' />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <>
         
              <button
                onClick={handleToggle}
                className={`flex items-center gap-2 font-semibold px-3 py-2 rounded-lg transition-colors duration-300 ${item?.isActive ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
              >
                {item?.isActive ? (
                  <>
                    <ToggleLeft className='w-4 h-4' />
                    <span>Set Inactive</span>
                  </>
                ) : (
                  <>
                    <ToggleRight className='w-4 h-4' />
                    <span>Set Active</span>
                  </>
                )}
              </button>
              {/* EDIT */}
              <button
                onClick={() => onCancel()} // onCancel will set mode to 'edit' in parent
                className='flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg transition-colors duration-300'
              >
                <Pencil className='w-4 h-4' />
                <span>Edit</span>
              </button>
              {/* DELETE */}
              <button
                onClick={() => { if (window.confirm('Hapus item pengetahuan ini secara permanen?')) onDelete(item!.id); }}
                className='flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-2 rounded-lg transition-colors duration-300'
              >
                <Trash2 className='w-4 h-4' />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </header>

     
      <div className='flex-1 overflow-y-auto p-6'>
   
        {!isAdding && (
          <div className={`mb-5 p-3 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${item?.isActive ? 'bg-green-500/20 text-green-300 border border-green-700' : 'bg-red-500/20 text-red-300 border border-red-700'}`}>
            {item?.isActive ? <CheckCircle className='w-4 h-4' /> : <XCircle className='w-4 h-4' />}
            Status: <span className='font-bold'>{item?.isActive ? 'Aktif' : 'Tidak Aktif'}</span> - Item ini {item?.isActive ? 'digunakan' : 'tidak digunakan'} oleh chatbot untuk menjawab.
          </div>
        )}

        <InputField
          label="Judul/Topik"
          name="title"
          value={formData.title}
          onChange={handleChange}
          isEditing={isEditing || isAdding}
        />
        <InputField
          label="Kategori"
          name="category"
          value={formData.category}
          onChange={handleChange}
          isEditing={isEditing || isAdding}
        />
        <InputField
          label="Konten Pengetahuan"
          name="content"
          value={formData.content}
          onChange={handleChange}
          isEditing={isEditing || isAdding}
          type="textarea"
          rows={7} 
        />

        
        {isAdding && (
          <div className="mb-6 flex items-center">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-300">Aktifkan item ini segera</label>
          </div>
        )}

        {/* Footer (di luar area scroll) */}
        <div className="mt-4 text-xs text-gray-500 flex-shrink-0">
          Terakhir Diperbarui: {new Date(formData.lastUpdated).toLocaleString()}
        </div>
      </div>
    </div>
  );
};


// --- (MAIN COMPONENT: KNOWLEDGE VIEW) ---
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [knowledgeItems, setKnowledgeItems] =
    useState<KnowledgeItem[]>(mockKnowledgeItems);
  const [selectedItem, setSelectedItem] =
    useState<KnowledgeItem | null>(mockKnowledgeItems[0] || null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view'); 

  const [isUpdatingRag, setIsUpdatingRag] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [searchQuery, setSearchQuery] = useState('');


  const filteredItems = useMemo(() => {
    return knowledgeItems.filter(
      (item) =>
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [knowledgeItems, searchQuery]);

  // Handler for list item click
  const handleSelectItem = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setMode('view');
  };
  

  const handleAddInfoClick = () => {
    setSelectedItem(null);
    setMode('add');
  };

  const handleUpdateRag = () => {
    setIsUpdatingRag(true);
    console.log('Memulai update RAG...');
    setTimeout(() => {
      setIsUpdatingRag(false);
      console.log('Update RAG selesai.');
      alert('Model RAG telah berhasil diperbarui dengan data terbaru.');
    }, 5000);
  };

  const handleSaveItem = (updatedItem: KnowledgeItem, isNew: boolean) => {
    if (isNew) {
        setKnowledgeItems((prev) => [...prev, updatedItem]);
        setSelectedItem(updatedItem);
        alert(`Item pengetahuan "${updatedItem.title}" berhasil ditambahkan.`);
    } else {
        setKnowledgeItems((prev) =>
          prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );
        setSelectedItem(updatedItem);
        alert(`Item pengetahuan "${updatedItem.title}" berhasil diperbarui.`);
    }
    setMode('view');
  };

  const handleCancelAction = () => {
    if (mode === 'add') {
 
      setSelectedItem(knowledgeItems[0] || null);
      setMode('view');
    } else if (mode === 'edit') {
     
      setMode('view');
    } else if (mode === 'view' && selectedItem) {
 
      setMode('edit');
    }
  };

  const handleDeleteItem = (id: string) => {
    setKnowledgeItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem(knowledgeItems.find(i => i.id !== id) || null);
    setMode('view');
    console.log(`Item ${id} dihapus.`);
  };

  const handleToggleStatus = (id: string) => {
    setKnowledgeItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive, lastUpdated: new Date().toISOString() } : item
      )
    );
    setSelectedItem((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, isActive: !prev.isActive, lastUpdated: new Date().toISOString() };
      }
      return prev;
    });
  };

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
          {/* Change to History View Button Card */}
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-white'>History View</h2>
              <p className='text-sm text-gray-400 mt-1'>Riwayat percakapan user</p>
            </div>
            <button
              onClick={onBack}
              className='flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-300'
            >
              <RefreshCw className='w-5 h-5' />
              <span>History</span>
            </button>
          </div>

          {/* Update RAG Button Card */}
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Update RAG</h2>
              <p className='text-sm text-gray-400 mt-1'>Perbarui model dengan data terbaru.</p>
            </div>
            <button
              onClick={handleUpdateRag}
              disabled={isUpdatingRag}
              className='flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-300 disabled:bg-neutral-600 disabled:cursor-not-allowed'
            >
              {isUpdatingRag ? (
                <>
                  <DatabaseZap className='w-5 h-5 animate-spin' />
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

          {/* Add Information Button Card (New) */}
          <div className='bg-neutral-800 border border-neutral-700 rounded-lg p-6 flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-white'>Tambah Informasi</h2>
              <p className='text-sm text-gray-400 mt-1'>Input item pengetahuan baru secara manual.</p>
            </div>
            <button
              onClick={handleAddInfoClick}
              className='flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-300'
              disabled={mode !== 'view'}
            >
              <PlusCircle className='w-5 h-5' />
              <span>Add Info</span>
            </button>
          </div>

        </section>

        {/* Knowledge Base Section */}
        <section className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Knowledge Item List */}
          <div className='lg:col-span-1 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
            <div className='p-4 border-b border-neutral-700 flex-shrink-0'>
              <h2 className='text-lg font-semibold flex items-center mb-4 gap-2'>
                <FileText /> Knowledge Item List
              </h2>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none' />
                <input
                  type='text'
                  placeholder='Cari ID, Judul, atau Konten...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-neutral-900 text-gray-200 rounded-lg border border-neutral-600 focus:ring-1 focus:ring-blue-500 focus:outline-none pl-10 pr-4 py-2 text-sm transition-colors'
                  disabled={mode !== 'view'}
                />
              </div>
            </div>

            {/* List Body */}
            <div className='overflow-y-auto flex-1'>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    disabled={mode !== 'view'} 
                    className={`w-full text-left p-4 border-l-4 hover:bg-neutral-700/50 transition-colors duration-200 ${selectedItem?.id === item.id && mode !== 'add'
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'border-transparent'
                      }`}
                  >
                    <div className='flex justify-between items-center'>
                      <p className='font-bold text-white text-sm'>
                        {item.title}
                      </p>
                      {item.isActive ? (
                        <CheckCircle className='w-4 h-4 text-green-400' />
                      ) : (
                        <XCircle className='w-4 h-4 text-red-400' />
                      )}
                    </div>
                    <p className='text-sm text-gray-400 truncate mt-1'>
                      {item.content}
                    </p>
                    <p className='text-xs text-gray-500 mt-2'>
                      {mounted ? `Update: ${new Date(item.lastUpdated).toLocaleString()}` : ''}
                    </p>
                  </button>
                ))
              ) : (
                <div className='text-center text-gray-500 p-8'>
                  <p>Item pengetahuan tidak ditemukan.</p>
                </div>
              )}
            </div>
          </div>


          <div className='lg:col-span-2 bg-neutral-800 border border-neutral-700 rounded-lg h-[600px] flex flex-col'>
        
            <KnowledgeDetailForm
              item={mode === 'add' ? null : selectedItem} 
              mode={mode}
              onSave={handleSaveItem}
              onCancel={handleCancelAction}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteItem}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

