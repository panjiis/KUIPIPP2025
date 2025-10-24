# app.py (Dengan Perbaikan untuk RAG)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import multiprocessing
import gc
import importlib

# Import rag module
import rag

# Reload module untuk memastikan menggunakan versi terbaru
importlib.reload(rag)

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

@app.get("/do-scrapping")
def do_scrapping_route():
    return {"Status": "Not Implemented"}

@app.get("/do-rag")
def do_rag_route():
    """Endpoint untuk menjalankan proses indexing RAG"""
    print("\n" + "="*50)
    print("Menerima permintaan /do-rag...")
    print("="*50)
    
    try:
        # Paksa cleanup sebelum memulai proses RAG
        print("Membersihkan memori sebelum proses RAG...")
        gc.collect()
        
        print("Memulai proses RAG di dalam proses terpisah...")
        rag_process = multiprocessing.Process(target=rag.mainrag)
        rag_process.start()
        rag_process.join()
        
        # Cleanup setelah proses selesai
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
            print("⚠️ Proses RAG selesai dengan warning")
            print("="*50)
            return {
                "Status": "Warning", 
                "Message": "RAG process completed with warnings. Check logs."
            }
            
    except Exception as e:
        print(f"❌ Error di /do-rag: {e}")
        return {
            "Status": "Error", 
            "Message": f"Failed to complete RAG process: {str(e)}"
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
    print("  POST /reply          - Send question to chatbot")
    print("  GET  /do-rag         - Run RAG indexing process")
    print("  GET  /clear-cache    - Clear memory/cache")
    print("  GET  /reset-memory   - Reset conversation history")
    print("="*50 + "\n")
    
    uvicorn.run(app, host="127.0.0.1", port=8080)