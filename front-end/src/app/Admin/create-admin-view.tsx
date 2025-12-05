// Admin/create-admin-view.tsx
'use client';
import { useState } from 'react';
import { UserPlus, Loader2, CornerDownLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface CreateAdminViewProps {
  onBack: () => void;
}

export default function CreateAdminView({ onBack }: CreateAdminViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- LOGOUT LOGIC ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Proses logout gagal.');
      window.location.href = '/login';
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`Error saat logout: ${err.message}`);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui saat logout.');
      }
      setIsLoggingOut(false);
    }
  };

  // --- CREATE ADMIN LOGIC ---
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password.length < 6) {
      toast.warning('Password minimal harus 6 karakter.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal membuat akun.');
      }

      toast.success(`Akun admin "${username}" berhasil dibuat!`);
      onBack(); // Kembali ke dashboard setelah sukses

    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bg-gray-50 dark:bg-neutral-950 min-h-screen text-gray-900 dark:text-gray-200 font-sans p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center'>
      
      {/* Container Utama (Card Centered) */}
      <div className='w-full max-w-lg'>
        
        {/* Tombol Logout di pojok kanan atas (Opsional jika ingin tetap di header) */}
        <div className="absolute top-6 right-6">
          <button 
            onClick={handleLogout} 
            disabled={isLoggingOut} 
            className='flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'
          >
             {isLoggingOut ? <Loader2 className='w-4 h-4 animate-spin' /> : <LogOut className='w-4 h-4' />}
             <span>{isLoggingOut ? 'Keluar...' : 'Keluar'}</span>
          </button>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-lg p-8">
          
          <header className='mb-8 text-center'>
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
               <UserPlus className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white tracking-tight'>Buat Akun Admin</h1>
            <p className='text-gray-500 dark:text-gray-400 mt-2 text-sm'>Tambahkan administrator baru untuk mengelola sistem.</p>
          </header>

          <form className="space-y-6" onSubmit={handleCreateAdmin}>
            
            {/* Input Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                Username Baru
              </label>
              <input 
                id="username" 
                name="username" 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-neutral-600" 
                placeholder="Masukkan username" 
              />
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                Password Baru
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-neutral-600" 
                placeholder="Minimal 6 karakter" 
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                onClick={onBack} 
                className="flex-1 py-3 px-4 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex justify-center items-center gap-2"
              >
                <CornerDownLeft className="w-4 h-4" />
                <span>Batal</span>
              </button>
              
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{loading ? 'Memproses...' : 'Buat Akun'}</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}