import type { Metadata } from "next";

// Mengatur judul halaman yang akan muncul di tab browser
export const metadata: Metadata = {
  title: "Admin Login | Chatbot Dashboard",
  description: "Halaman login untuk admin dashboard chatbot.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Kita bisa mengatur styling dasar seperti font dan background di sini
    <html lang="id">
      <body className="bg-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}