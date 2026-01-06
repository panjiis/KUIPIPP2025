// src/app/Admin/rag-detail-view.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  Loader2, 
  CornerDownLeft,
  Wand2, // Icon tongkat sihir untuk fitur AI
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'sonner';

// --- INTERFACES ---
interface RagDetailViewProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface CategoryOption {
  label: string;
  value: string;
}

export default function RagDetailView({ onBack, onSuccess }: RagDetailViewProps) {
  // State Input
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  
  // State Kategori
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // State Proses Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>(''); // Status teks (misal: "Sedang membaca PDF...")
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. FETCH KATEGORI (Dari Node.js Port 5000)
  // Agar dropdown kategori terisi data yang sudah ada sebelumnya
  useEffect(() => {
    setIsLoadingCategories(true);
    fetch('http://localhost:5000/api/knowledge/categories')
      .then(res => res.json())
      .then(json => {
        if (!json.error && json.data) {
          const options = json.data.map((cat: { name: string }) => ({
            label: cat.name,
            value: cat.name
          }));
          setCategoryOptions(options);
        }
      })
      .catch(err => console.error("Gagal load kategori:", err))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  // 2. HANDLER PILIH FILE
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      
      // Validasi Ukuran (Max 10MB agar tidak timeout)
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("Ukuran file terlalu besar (Maks 10MB)");
        return;
      }

      // Validasi Tipe
      if (selected.type === 'application/pdf' || selected.type === 'text/plain') {
        setFile(selected);
        // Otomatis isi topik dari nama file jika field topik masih kosong
        if (!topic) {
          const name = selected.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
          setTopic(name);
        }
      } else {
        toast.error("Format file harus PDF atau TXT");
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 3. HANDLER UPLOAD (Ke Python Port 8080)
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !topic || !category) {
      toast.warning("Mohon lengkapi Topik, Kategori, dan File.");
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('topic', topic);
      formData.append('category', category);

      // STEP 1: Upload ke Python untuk diproses AI
      setUploadStep('AI sedang membaca & merapikan format PDF...');
      
      // NOTE: Mengirim ke Port 8080 (Python) karena di sana ada logic "Smart Formatting"
      const response = await fetch('http://localhost:8080/api/upload-knowledge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Gagal memproses dokumen di server AI.');
      }

    

      // STEP 2: Sukses
      setUploadStep('Selesai! Menyimpan data...');
      await new Promise(r => setTimeout(r, 800)); // Delay dikit untuk UX

      toast.success("Dokumen Berhasil Diproses!", {
        description: "Teks PDF telah dirapikan menjadi format tabel/list dan disimpan ke Knowledge Base."
      });

      // Reset
      setFile(null);
      setTopic('');
      setCategory('');
      
      // Kembali ke halaman list knowledge
      onSuccess();

    } catch (error) {
      console.error("Upload Error:", error);
      toast.error("Gagal Memproses Dokumen", {
        description: error instanceof Error ? error.message : "Terjadi kesalahan server AI (Port 8080)."
      });
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  // --- RENDER UI ---
  return (
    <div className='p-6 h-full flex flex-col overflow-y-auto bg-gray-50 dark:bg-neutral-950'>
      <div className='max-w-3xl mx-auto w-full'>
        
        {/* Header */}
        <div className='mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <UploadCloud className="w-8 h-8 text-blue-600" />
              Upload Dokumen Cerdas
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-1 text-sm'>
              Upload PDF (Jadwal, Biaya, SK), AI akan otomatis membaca dan memperbaiki tabel yang berantakan.
            </p>
          </div>
          <button
            onClick={onBack}
            disabled={isUploading}
            className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 dark:bg-neutral-900 dark:border-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50'
          >
            <CornerDownLeft className='w-4 h-4' />
            Batal
          </button>
        </div>

        {/* Card Form */}
        <div className='bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm p-6'>
          <form onSubmit={handleUpload} className='space-y-6'>
            
            {/* 1. Input Topik & Kategori */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              
              {/* Judul */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2'>
                  Judul / Topik Dokumen
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Jadwal UAS Semester Genap 2025"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm"
                  required
                  disabled={isUploading}
                />
              </div>

              {/* Kategori (Dropdown Creatable) */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2'>
                  Kategori
                </label>
                <CreatableSelect
                  isClearable
                  isDisabled={isUploading || isLoadingCategories}
                  isLoading={isLoadingCategories}
                  onChange={(newValue) => setCategory(newValue ? newValue.value : '')}
                  onCreateOption={(inputValue) => {
                    setCategory(inputValue);
                    // Tambahkan opsi baru sementara ke state agar user melihatnya
                    setCategoryOptions(prev => [...prev, { label: inputValue, value: inputValue }]);
                  }}
                  options={categoryOptions}
                  value={category ? { label: category, value: category } : null}
                  placeholder="Pilih atau Ketik Baru..."
                  classNames={{
                    control: (state) =>
                      `!bg-gray-50 dark:!bg-neutral-950 !border-gray-200 dark:!border-neutral-800 !rounded-xl !shadow-none !py-0.5 ${
                        state.isFocused ? '!ring-2 !ring-blue-500 !border-transparent' : ''
                      }`,
                    menu: () => 
                      '!bg-white dark:!bg-neutral-900 !border !border-gray-200 dark:!border-neutral-800 !rounded-xl !mt-1 !shadow-lg',
                    option: (state) =>
                      `!cursor-pointer !text-sm ${
                        state.isFocused
                          ? '!bg-blue-50 dark:!bg-blue-900/30 !text-blue-700 dark:!text-blue-200'
                          : '!bg-white dark:!bg-neutral-900 !text-gray-900 dark:!text-white'
                      }`,
                    singleValue: () => '!text-gray-900 dark:!text-white !text-sm',
                    input: () => '!text-gray-900 dark:!text-white !text-sm',
                    placeholder: () => '!text-gray-400 !text-sm'
                  }}
                />
              </div>
            </div>

            {/* 2. Drag & Drop Area */}
            <div>
              <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2'>
                File Dokumen (PDF/TXT)
              </label>
              <div 
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative group
                  ${file 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' 
                    : 'border-gray-300 dark:border-neutral-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                
                {!file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        Klik atau Tarik File PDF ke sini
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Maksimal 10MB. Disarankan PDF yang berisi teks (bukan scan gambar).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 relative z-20">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-red-100 text-red-600 rounded-lg">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900 dark:text-white truncate max-w-[200px] text-sm">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Mencegah trigger input file lagi
                        removeFile();
                      }}
                      disabled={isUploading}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Info AI Box */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
              <Wand2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Fitur AI Auto-Format:</strong> Sistem akan otomatis membaca PDF Anda. Jika ada tabel jadwal atau daftar poin yang berantakan, AI akan menyusunnya kembali menjadi format tabel yang rapi agar mudah diedit nanti.
              </div>
            </div>

            {/* 4. Submit Button */}
            <button
              type="submit"
              disabled={isUploading || !file}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-3
                ${isUploading || !file
                  ? 'bg-gray-400 dark:bg-neutral-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/30 active:scale-[0.98]'
                }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="animate-pulse">{uploadStep}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Upload & Proses dengan AI</span>
                </>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}