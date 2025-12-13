'use client';
import { useState } from 'react';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react'; // <--- Import Icon Baru

// --- INTERFACE ---
interface LoginSuccessResponse {
  message: string;
  token?: string;
  role: string;
}

interface LoginErrorResponse {
  message: string;
}

type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // STATE BARU: Untuk toggle visibilitas password
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as LoginErrorResponse).message || 'Gagal untuk login.');
      }

      // Simpan role ke localStorage agar menu Admin muncul
      const successData = data as LoginSuccessResponse;
      if (successData.role) {
        localStorage.setItem('role', successData.role);
      }

      window.location.href = '/Admin';
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-gray-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-neutral-800 rounded-2xl shadow-lg border border-neutral-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Admin Login</h1>
          <p className="mt-2 text-gray-400">Masuk untuk mengakses dashboard.</p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="username" className="text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 block w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 placeholder-neutral-500"
              placeholder="Masukkan username Anda"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-300">
              Password
            </label>
            
            {/* WRAPPER RELATIVE UNTUK POSISI ICON */}
            <div className="relative mt-2">
              <input
                id="password"
                name="password"
                // UBAH TYPE BERDASARKAN STATE
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // Tambahkan pr-10 (padding right) agar teks tidak tertutup icon
                className="block w-full pl-4 pr-12 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 placeholder-neutral-500"
                placeholder="••••••••"
              />
              
              {/* TOMBOL TOGGLE PASSWORD */}
              <button
                type="button" // PENTING: type button agar tidak submit form
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white transition-colors"
                title={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-center text-red-400 text-sm bg-red-900/20 p-2 rounded-lg border border-red-900/50">
              <p>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              <span>{loading ? 'Memproses...' : 'Login'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}