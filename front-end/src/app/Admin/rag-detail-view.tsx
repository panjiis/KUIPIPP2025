// Admin/rag-detail-view.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  Loader2, 
  CornerDownLeft
} from 'lucide-react';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'sonner';

// 1. Interface Data Knowledge (Pengganti 'any')
interface KnowledgeItem {
  _id: string;
  topic: string;
  content: string;
  category: string;
  status: string;
}

interface RagDetailViewProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface CategoryOption {
  label: string;
  value: string;
}

export default function RagDetailView({ onBack, onSuccess }: RagDetailViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  
  // State Kategori
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadLatestBackup = async () => {
    try {
      console.log("Memulai proses download backup...");

      const res = await fetch('http://localhost:5000/api/knowledge', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', 
      });

      if (!res.ok) {
        throw new Error(`Gagal mengambil data knowledge. Status: ${res.status}`);
      }

      const json = await res.json();
      console.log("Data Knowledge diterima:", json); 

      const items = json.data || json; 

      if (items && Array.isArray(items) && items.length > 0) {
        
        const fileContent = items.map((item: KnowledgeItem) => (
          `TOPIC: ${item.topic}\n` +
          `CATEGORY: ${item.category}\n` +
          `STATUS: ${item.status}\n` +
          `CONTENT:\n${item.content}\n` +
          `--------------------------------------------------\n`
        )).join('\n');

        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().getTime();
        link.href = url;
        link.download = `knowledge-backup-rag-${timestamp}.txt`;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
      } else {
        console.warn("Data knowledge kosong atau format salah.");
        toast.warning("Data kosong, tidak ada file yang diunduh.");
      }
    } catch (error) {
      console.error("Gagal mendownload backup otomatis:", error);

    }
  };

  // 3. Load Kategori saat komponen di-mount
  useEffect(() => {
    setIsLoadingCategories(true);
    fetch('http://localhost:5000/api/knowledge/categories')
      .then((res) => res.json())
      .then((json) => {
        if (!json.error && json.data) {
          const options = json.data.map((cat: { name: string }) => ({
            label: cat.name,
            value: cat.name,
          }));
          setCategoryOptions(options);
        }
      })
      .catch((err) => console.error('Gagal load kategori:', err))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  const handleCategoryChange = (newValue: CategoryOption | null) => {
    setCategory(newValue ? newValue.value : '');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'text/plain'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Format file tidak didukung. Harap upload PDF atau TXT.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar (Maks 10MB).');
      return;
    }
    setFile(selectedFile);
    if (!topic) {
      setTopic(selectedFile.name.replace(/\.[^/.]+$/, "")); 
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Handle Upload Utama
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !topic || !category) {
      toast.warning('Mohon lengkapi File, Judul Topik, dan Kategori.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('topic', topic);
    formData.append('category', category);

    try {
      // A. Kirim ke FastAPI (Port 8080) untuk Upload & RAG Indexing
      const res = await fetch('http://localhost:8080/api/upload-knowledge', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Gagal mengupload file.');
      }

      // B. TRIGGER DOWNLOAD BACKUP
      // Dilakukan SETELAH upload sukses agar data PDF baru sudah masuk di database
      await downloadLatestBackup();

      toast.success('Upload Berhasil & Cadangan TXT Diunduh!', {
        description: `File "${file.name}" telah di-index ke RAG.`,
        duration: 3000,
      });

      // Reset form
      setFile(null);
      setTopic('');
      setCategory('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`Error: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan saat upload.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col bg-gray-50 dark:bg-neutral-950 min-h-screen text-gray-900 dark:text-gray-200 transition-colors duration-300'>
      
      {/* Header */}
      <header className='mb-8 flex justify-between items-start'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white tracking-tight'>
            Upload Knowledge (Auto-RAG)
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            Upload dokumen PDF/TXT. Sistem akan otomatis melakukan indexing dan mengunduh cadangan data terbaru.
          </p>
        </div>
        <button
          onClick={onBack}
          className='flex items-center gap-2 py-2 px-4 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors'
        >
          <CornerDownLeft className='w-4 h-4' />
          <span>Kembali</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm p-8 h-fit transition-colors duration-300">
          
          <form onSubmit={handleUpload} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Judul / Topik
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Panduan Akademik 2025"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Kategori
                </label>
                <CreatableSelect
                  isClearable
                  isDisabled={isLoadingCategories}
                  isLoading={isLoadingCategories}
                  onChange={handleCategoryChange}
                  onCreateOption={(inputValue) => {
                    handleCategoryChange({ label: inputValue, value: inputValue });
                  }}
                  options={categoryOptions}
                  value={category ? { label: category, value: category } : null}
                  placeholder="Pilih atau Ketik Kategori..."
                  required
                  
                  classNames={{
                    control: (state) =>
                      `!bg-gray-50 dark:!bg-neutral-950 !border-gray-200 dark:!border-neutral-700 !rounded-lg !text-sm !shadow-none !min-h-[48px] !px-2 ${
                        state.isFocused ? '!ring-2 !ring-blue-500 !border-transparent' : ''
                      }`,
                    menu: () => 
                      '!bg-white dark:!bg-neutral-900 !border !border-gray-200 dark:!border-neutral-700 !rounded-lg !mt-1 !z-50',
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
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Dokumen Sumber (PDF / TXT)
              </label>
              
              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
                    Klik untuk upload atau drag & drop
                  </p>
                  <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                    PDF atau TXT (Maks. 10MB)
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.txt"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center justify-between animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-blue-100 dark:border-blue-800">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isUploading || !file}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all transform active:scale-[0.98]
                  ${isUploading || !file
                    ? 'bg-gray-400 dark:bg-neutral-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sedang Upload & Indexing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    <span>Upload & Proses RAG Sekarang</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}