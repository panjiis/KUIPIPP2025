from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import multiprocessing
import gc
import importlib
import io
import os
import json
import asyncio
from datetime import datetime
from pymongo import MongoClient

# --- PERUBAHAN: GANTI PYPDF DENGAN PDFPLUMBER ---
import pdfplumber 

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
    return {"Hello": "Server AI Chatbot (WebSocket Ready + Table Support)"}

# ==============================================================================
# HELPER: KONVERSI TABEL KE MARKDOWN
# ==============================================================================
def convert_table_to_markdown(table):
    """
    Mengubah list of lists dari pdfplumber menjadi string Markdown Table.
    Contoh Input: [['Nama', 'Umur'], ['Ali', '20']]
    Output: 
    | Nama | Umur |
    |---|---|
    | Ali | 20 |
    """
    if not table or len(table) < 2: return ""
    
    try:
        # 1. Bersihkan None menjadi string kosong
        cleaned_table = [[str(cell) if cell is not None else "" for cell in row] for row in table]
        
        # 2. Buat Header
        header = "| " + " | ".join(cleaned_table[0]) + " |"
        separator = "| " + " | ".join(["---"] * len(cleaned_table[0])) + " |"
        
        # 3. Buat Body
        body = ""
        for row in cleaned_table[1:]:
            # Gabungkan row, ganti newline dalam sel dengan spasi agar tabel tidak pecah
            clean_row = [cell.replace("\n", " ") for cell in row]
            body += "\n| " + " | ".join(clean_row) + " |"
            
        return f"\n{header}\n{separator}{body}\n"
    except Exception as e:
        print(f"⚠️ Table conversion error: {e}")
        return ""

# ==============================================================================
# 1. WEBSOCKET ENDPOINT (UTAMA)
# ==============================================================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(f"🔌 Client Connected: {websocket.client}")
    
    try:
        while True:
            # 1. Terima Pesan
            raw_data = await websocket.receive_text()
            
            try:
                payload = json.loads(raw_data)
                message = payload.get("message", "")
            except json.JSONDecodeError:
                message = raw_data

            if not message: continue

            print(f"📩 Received (WS): {message}")

            # 2. Proses RAG (Non-blocking)
            reply_text = await asyncio.to_thread(rag.ask, message, [])

            # 3. Kirim Balasan
            response_data = {"Reply": reply_text}
            await websocket.send_json(response_data)
            
            await asyncio.to_thread(gc.collect)

    except WebSocketDisconnect:
        print(f"🔌 Client Disconnected: {websocket.client}")
    except Exception as e:
        print(f"⚠️ WebSocket Error: {e}")
        try: await websocket.close()
        except: pass

# ==============================================================================
# 2. HTTP ENDPOINTS (UPLOAD & ADMIN)
# ==============================================================================

@app.post("/reply")
async def reply_http(req: Request):
    """Fallback HTTP jika client belum support WS"""
    try:
        data = await req.json()
        message = data.get("message", "")
        reply_text = rag.ask(message, [])
        return {"Reply": reply_text}
    except Exception as e:
        return {"Reply": f"Error: {str(e)}"}

@app.post("/api/upload-knowledge")
async def upload_knowledge(
    file: UploadFile = File(...),
    topic: str = Form(...),
    category: str = Form(...)
):
    print(f"📂 Upload: {file.filename}")
    try:
        content_text = ""
        file_content = await file.read()
        
        # 1. Ekstrak PDF dengan PDFPLUMBER (Lebih jago Tabel)
        if file.filename.lower().endswith('.pdf'):
            try:
                # Membuka PDF dari memory
                with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                    for i, page in enumerate(pdf.pages):
                        page_content = ""
                        
                        # A. Coba Ekstrak Tabel Dulu
                        tables = page.extract_tables()
                        if tables:
                            print(f"   📄 Page {i+1}: Found {len(tables)} tables.")
                            for table in tables:
                                # Konversi ke Markdown Table biar AI paham
                                md_table = convert_table_to_markdown(table)
                                page_content += f"\n\n{md_table}\n\n"
                        
                        # B. Ambil Teks Biasa (untuk narasi)
                        text = page.extract_text()
                        if text:
                            page_content += text + "\n"
                        
                        content_text += page_content
                        
            except Exception as e:
                print(f"❌ PDFPlumber Error: {e}")
                raise HTTPException(status_code=400, detail=f"Bad PDF: {str(e)}")
                
        elif file.filename.lower().endswith('.txt'):
            content_text = file_content.decode('utf-8', errors='ignore')
        else:
            raise HTTPException(status_code=400, detail="Only PDF/TXT allowed")

        if not content_text.strip():
             raise HTTPException(status_code=400, detail="Empty content")

        # 2. Smart Formatting (AI)
        # AI sekarang menerima input yang sudah ada tabel Markdown-nya
        # Tugas AI tinggal merapikan sisanya.
        print("🤖 AI Formatting...")
        formatted_content = rag.smart_clean_text(content_text)

        # 3. Simpan ke Mongo
        mongo_uri = os.getenv("MONGO_URI")
        db_name = os.getenv("MONGO_DB_NAME")
        
        client = MongoClient(mongo_uri)
        db = client[db_name]
        collection = db["knowledgebase"]
        
        new_doc = {
            "topic": topic,
            "category": category,
            "content": formatted_content, 
            "status": "ACTIVE",
            "is_sync": False, 
            "updatedAt": datetime.now().isoformat()
        }
        
        result = collection.insert_one(new_doc)
        client.close()
        
        # 4. Trigger Auto-Index
        print("🔄 Auto-Indexing...")
        importlib.reload(rag)
        rag_process = multiprocessing.Process(target=rag.mainrag)
        rag_process.start()
        rag_process.join()
        
        if rag_process.exitcode == 0:
             return {
                "message": "Sukses! Tabel PDF berhasil dikonversi & disimpan.",
                "data": {"_id": str(result.inserted_id), "topic": topic}
            }
        else:
            raise HTTPException(status_code=500, detail="Indexing Failed")

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/do-rag")
def do_rag_route():
    """Manual Re-Index"""
    print("🔄 Manual RAG Triggered...")
    try:
        importlib.reload(rag)
        rag_process = multiprocessing.Process(target=rag.mainrag)
        rag_process.start()
        rag_process.join()
        
        if rag_process.exitcode == 0:
            return {"Status": "Success", "Message": "RAG Re-indexed from MongoDB"}
        else:
            return {"Status": "Error", "Message": "RAG Process Failed"}
    except Exception as e:
        return {"Status": "Error", "Message": str(e)}

@app.get("/clear-cache")
def clear_cache():
    rag.force_cleanup_chroma()
    return {"Status": "Cache cleared"}

@app.get("/reset-memory")
def reset_memory_route():
    rag.reset_memory()
    return {"Status": "Memory reset"}

if __name__ == "__main__":
    import uvicorn
    multiprocessing.set_start_method('spawn', force=True)
    print("🚀 Starting Server (WS Port 8080)...")
    uvicorn.run(app, host="127.0.0.1", port=8080)