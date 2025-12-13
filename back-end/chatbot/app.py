# app.py (Full Code dengan Upload & Auto-RAG)
from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import multiprocessing
import gc
import importlib
import io
import os
from datetime import datetime
from pymongo import MongoClient
from pypdf import PdfReader

# Import rag module
import rag

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "Ini adalah server AI untuk Chatbot"}

@app.post("/reply")
async def reply(req: Request):
    """Endpoint untuk menjawab pertanyaan"""
    try:
        data = await req.json()
        message = data.get("message", "")
        reply_text = rag.ask(message)
        
        # PENTING: Cleanup setelah setiap request
        gc.collect()
        
        return {"Reply": reply_text}
    except Exception as e:
        print(f"Error di /reply: {e}")
        return {"Reply": "⚠️ Terjadi kesalahan saat memproses pertanyaan."}

# === ENDPOINT BARU UNTUK UPLOAD & AUTO-RAG ===
@app.post("/api/upload-knowledge")
async def upload_knowledge(
    file: UploadFile = File(...),
    topic: str = Form(...),
    category: str = Form(...)
):
    """Endpoint untuk upload file PDF/TXT, simpan ke MongoDB, dan Auto-RAG"""
    print(f"📂 Menerima file untuk upload: {file.filename}")
    
    try:
        content_text = ""
        
        # 1. Baca File
        file_content = await file.read()
        
        # 2. Ekstrak Teks berdasarkan tipe file
        if file.filename.lower().endswith('.pdf'):
            try:
                # Menggunakan pypdf untuk membaca PDF dari memory (io.BytesIO)
                pdf_reader = PdfReader(io.BytesIO(file_content))
                for page in pdf_reader.pages:
                    text = page.extract_text()
                    if text:
                        content_text += text + "\n"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Gagal membaca PDF: {str(e)}")
                
        elif file.filename.lower().endswith('.txt'):
            try:
                content_text = file_content.decode('utf-8')
            except UnicodeDecodeError:
                # Fallback jika utf-8 gagal
                content_text = file_content.decode('latin-1')
        else:
            raise HTTPException(status_code=400, detail="Format file tidak didukung. Gunakan PDF atau TXT.")

        # Validasi konten kosong
        if not content_text.strip():
             raise HTTPException(status_code=400, detail="File kosong atau teks tidak terbaca (mungkin gambar/scan).")

        # 3. Simpan ke MongoDB
        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
             raise HTTPException(status_code=500, detail="MONGO_URI belum disetting di env.")

        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
             raise HTTPException(status_code=500, detail="MONGO_URI belum disetting di env.")

        client = MongoClient(mongo_uri)
        db = client["kui"]
        collection = db["knowledgebase"]
        
        new_doc = {
            "topic": topic,
            "category": category,
            "content": content_text,
            "status": "ACTIVE",
            "is_sync": False, # <--- TAMBAHAN: Default False saat baru upload
            "updatedAt": datetime.now().isoformat()
        }
        
        result = collection.insert_one(new_doc)
        client.close()
        
        print(f"✅ Data tersimpan di MongoDB dengan ID: {result.inserted_id}")
        
        # 4. AUTO RAG (Menjalankan Indexing Otomatis)
        print("🔄 Menjalankan Auto-RAG Indexing...")
        
        # Reload rag module agar config terbaru terbaca
        importlib.reload(rag)
        
        # Jalankan proses RAG (Indexing) di process terpisah agar memori aman
        rag_process = multiprocessing.Process(target=rag.mainrag)
        rag_process.start()
        rag_process.join() # Tunggu sampai selesai (blocking) agar user tahu statusnya
        
        # Bersihkan memori
        gc.collect()
        
        if rag_process.exitcode == 0:
             return {
                "message": "File berhasil diupload dan RAG telah diperbarui!",
                "data": {
                    "_id": str(result.inserted_id),
                    "topic": topic,
                    "category": category
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Gagal melakukan update RAG otomatis.")

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.get("/do-scrapping")
def do_scrapping_route():
    return {"Status": "Not Implemented"}

@app.get("/do-rag")
def do_rag_route():
    """Endpoint untuk menjalankan proses indexing RAG manual"""
    print("\n" + "="*50)
    print("Menerima permintaan /do-rag...")
    print("="*50)
    
    try:
        importlib.reload(rag)
        print("Modul 'rag' telah di-reload.")
        
        print("Membersihkan memori sebelum proses RAG...")
        gc.collect()
        
        print("Memulai proses RAG di dalam proses terpisah...")
        rag_process = multiprocessing.Process(target=rag.mainrag)
        rag_process.start()
        rag_process.join() # Menunggu proses selesai
        
        gc.collect()
        
        if rag_process.exitcode == 0:
            print("="*50)
            print("✓ Proses RAG berhasil diselesaikan!")
            print("  Server siap menerima pertanyaan baru.")
            print("="*50)
            return {
                "Status": "Success", 
                "Message": "RAG indexing completed successfully"
            }
        else:
            print("="*50)
            print("⚠️ Proses RAG GAGAL (exit code non-zero).")
            print("="*50)
            return {
                "Status": "Error", 
                "Message": "RAG process FAILED. Check backend logs for exceptions."
            }
            
    except Exception as e:
        print(f"❌ Error di /do-rag (level FastAPI): {e}")
        return {
            "Status": "Error", 
            "Message": f"Failed to start RAG process: {str(e)}"
        }

@app.get("/clear-cache")
def clear_cache():
    """Endpoint untuk membersihkan cache/memori"""
    print("Membersihkan cache...")
    rag.force_cleanup_chroma()
    return {"Status": "Cache cleared successfully"}

@app.get("/reset-memory")
def reset_memory():
    """Endpoint untuk mereset memory percakapan"""
    rag.reset_memory()
    return {"Status": "Conversation memory reset"}


if __name__ == "__main__":
    import uvicorn
    
    # Set multiprocessing method untuk Windows
    multiprocessing.set_start_method('spawn', force=True)
    
    print("\n" + "="*50)
    print("🚀 Starting FastAPI Server for RAG Chatbot")
    print("="*50)
    print("Available endpoints:")
    print("  POST /reply             - Send question to chatbot")
    print("  POST /api/upload-knowledge - Upload PDF/TXT & Auto-Index")
    print("  GET  /do-rag            - Run RAG indexing process manually")
    print("  GET  /clear-cache       - Clear memory/cache")
    print("  GET  /reset-memory      - Reset conversation history")
    print("="*50 + "\n")
    
    uvicorn.run(app, host="127.0.0.1", port=8080)