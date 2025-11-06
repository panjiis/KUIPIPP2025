# rag.py - COMPLETE VERSION
import os
import re
import shutil
import gc
import time
from contextlib import contextmanager
from pymongo import MongoClient
from langchain_core.documents import Document
from dotenv import load_dotenv
from difflib import SequenceMatcher

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from langdetect import detect as lang_detect
    HAVE_LANGDETECT = True
except Exception:
    HAVE_LANGDETECT = False

# --- Konfigurasi Global ---
load_dotenv() 

PERSIST_DIR = "chroma_db"
EMBED_MODEL = "nomic-embed-text"
LLM_MODEL = "qwen2.5:7b-instruct"
DEBUG = False
MAX_CONTEXT_LENGTH = 7000

MONGO_URI = os.getenv("MONGO_URI") 
MONGO_DB_NAME = "skripsi" 
MONGO_COLLECTION_NAME = "knowledgebase"

# --- Inisialisasi Model ---
try:
    embeddings = OllamaEmbeddings(model=EMBED_MODEL)
    print(f"Ollama Embeddings ({EMBED_MODEL}) dimuat.")
    llm = ChatOllama(model=LLM_MODEL, temperature=0.25)
    print(f"Ollama Chat LLM ({LLM_MODEL}) dimuat.")
except Exception as e:
    print(f"⚠️ Kesalahan inisialisasi model Ollama: {e}")
    embeddings = None
    llm = None

# Variabel global untuk memori percakapan
conversation_history = []

# Context manager untuk ChromaDB
@contextmanager
def get_chroma_db():
    """Context manager untuk membuka dan menutup ChromaDB dengan benar"""
    db = None
    try:
        db = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
        yield db
    finally:
        if db is not None:
            try:
                if hasattr(db, '_client'):
                    db._client.clear_system_cache()
                del db
            except Exception as e:
                print(f"Warning saat menutup ChromaDB: {e}")
            gc.collect()

def detect_language(text: str) -> str:
    if not text or not text.strip(): return "en"
    if HAVE_LANGDETECT:
        try:
            lang = lang_detect(text)
            if lang and lang.startswith("id"): return "id"
            if lang and lang.startswith("en"): return "en"
        except Exception: pass
    id_signals = ["apa", "yang", "berapa", "siapa", "di", "dengan", "untuk", "kapan", "mengapa", "jelaskan"]
    en_signals = ["what", "which", "who", "when", "why", "how", "tell", "list"]
    lower = text.lower()
    id_count = sum(1 for w in id_signals if w in lower)
    en_count = sum(1 for w in en_signals if w in lower)
    return "id" if id_count >= en_count else "en"

def rerank_local(docs, query, top_k=4):
    ranked = []
    for d in docs:
        content = getattr(d, "page_content", "") or ""
        meta_snip = ""
        if hasattr(d, "metadata") and isinstance(d.metadata, dict):
            meta_snip = " ".join([str(v) for v in d.metadata.values() if isinstance(v, (str, int))])[:300]
        score = SequenceMatcher(None, query.lower(), (content + " " + meta_snip).lower()).ratio()
        ranked.append((score, d))
    ranked.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in ranked[:top_k]]

def clean_context(context: str) -> str:
    context = re.sub(r"\s+", " ", context)
    context = re.sub(r"(?i)source:.*", "", context)
    return context.strip()

template = """
You are a professional academic chatbot that understands both Bahasa Indonesia and English.
Important rules (follow exactly):
- Detect user's language from the variable 'user_lang' and answer ONLY in that language.
- Use ONLY the provided CONTEXT SNIPPETS to answer. Do NOT invent facts.
- If no relevant info in the snippets, answer:
    - Bahasa Indonesia: "Tidak ditemukan dalam dokumen."
    - English: "Not found in the document."
- Keep answer concise, factual, and use markdown for lists / bolding important entities.

Context snippets (use these ONLY):
{context_snippets}
Conversation History (last few turns):
{history}
User question:
{question}
user_lang: {user_lang}
Answer:
"""
prompt = ChatPromptTemplate.from_template(template)

def summarize_context_if_needed(context: str) -> str:
    if not llm: return context
    if len(context) <= MAX_CONTEXT_LENGTH: return context
    print("⚙️ Context too long, asking LLM to summarize...")
    summary_prompt = f"Summarize the following context into concise factual bullets. Preserve facts and document references:\n\n{context}"
    resp = llm.invoke(summary_prompt)
    return resp.content.strip()

def ask(question: str) -> str:
    """Fungsi untuk menjawab pertanyaan menggunakan RAG"""
    if not llm or not embeddings:
        return "⚠️ Sistem RAG belum siap. Cek konfigurasi backend dan pastikan Ollama berjalan."
    
    try:
        with get_chroma_db() as db:
            retriever = db.as_retriever(search_kwargs={"k": 8})
            
            user_lang = detect_language(question)
            docs = retriever.invoke(question)
            top_docs = rerank_local(docs, question, top_k=6)
            
            if not top_docs:
                return "❌ Not found in the document." if user_lang == "en" else "❌ Tidak ditemukan dalam dokumen."
            
            snippets = []
            for i, d in enumerate(top_docs, start=1):
                text = clean_context(getattr(d, "page_content", "") or "")
                excerpt = (text[:800] + "...") if len(text) > 800 else text
                src = d.metadata.get("source", "unknown") if hasattr(d, "metadata") else "unknown"
                topic = d.metadata.get("topic", "") if hasattr(d, "metadata") else ""
                src_display = f"{src} (Topic: {topic})" if topic else src
                snippets.append(f"Snippet {i} (source: {src_display}):\n{excerpt}")
            
            context_combined = "\n\n".join(snippets)
            context_combined = summarize_context_if_needed(context_combined)
            formatted_history = "\n".join([f"Human: {h[0]}\nAI: {h[1]}" for h in conversation_history[-6:]]) if conversation_history else "None"
            
            chain = prompt | llm
            inputs = {
                "context_snippets": context_combined, 
                "history": formatted_history, 
                "question": question, 
                "user_lang": "Bahasa Indonesia" if user_lang == "id" else "English"
            }
            result = chain.invoke(inputs)
            answer = result.content.strip()
            
            if re.search(r"not found in the document", answer, re.IGNORECASE) and user_lang == "id": 
                answer = "Tidak ditemukan dalam dokumen."
            if re.search(r"tidak ditemukan dalam dokumen", answer, re.IGNORECASE) and user_lang == "en": 
                answer = "Not found in the document."
            
            conversation_history.append((question, answer))
            answer = re.sub(r"\n{3,}", "\n\n", answer).strip() + "\n"
            
            if DEBUG: 
                print("=== DEBUG ===\nLang:", user_lang, "\nHistory:", formatted_history, "\nTop snippets:", snippets[:2])
            
            return answer
        
    except Exception as e:
        print(f"Error saat memproses pertanyaan: {e}")
        return "⚠️ Gagal memuat database pengetahuan. Pastikan proses RAG sudah dijalankan."

def reset_memory():
    global conversation_history
    conversation_history = []
    print("Memory percakapan telah direset.")

# Ganti fungsi load_from_mongo() di rag.py Anda dengan ini:

def load_from_mongo():
    print(f"Mencoba terhubung ke MongoDB: {MONGO_DB_NAME}/{MONGO_COLLECTION_NAME}")
    if not MONGO_URI:
        print("Error: MONGO_URI tidak ditemukan di environment variables.")
        return []
    try:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
        
        # --- PERUBAHAN UTAMA DI SINI ---
        # Tambahkan filter untuk hanya mengambil dokumen dengan status "ACTIVE"
        print("Filter diterapkan: Hanya dokumen dengan status 'ACTIVE' yang akan diambil.")
        mongo_docs = list(collection.find({ "status": "ACTIVE" }))
        
        client.close()
        
        langchain_docs = []
        for doc in mongo_docs:
            page_content = f"Topik Bahasan: {doc.get('topic')}\n\nInformasi Detail: {doc.get('content')}"
            metadata = {"source": "mongodb", "topic": doc.get('topic'), "category": doc.get('category')}
            langchain_docs.append(Document(page_content=page_content, metadata=metadata))
            
        print(f"Berhasil memuat {len(langchain_docs)} dokumen dari MongoDB yang berstatus ACTIVE.")
        return langchain_docs
        
    except Exception as e:
        print(f"Error saat memuat dari MongoDB: {e}")
        return []

def force_cleanup_chroma():
    """Paksa bersihkan semua koneksi ChromaDB"""
    gc.collect()
    time.sleep(0.5)

def mainrag():
    """Fungsi utama untuk proses indexing RAG"""
    if embeddings is None:
        print("Embeddings gagal dimuat. Proses RAG (indexing) dibatalkan.")
        return 0
    
    force_cleanup_chroma()
    
    if os.path.exists(PERSIST_DIR):
        print(f"Database lama ditemukan di '{PERSIST_DIR}'...")
        
        backup_dir = f"{PERSIST_DIR}_backup_{int(time.time())}"
        max_attempts = 5
        
        for attempt in range(max_attempts):
            try:
                print(f"Mencoba rename folder (percobaan {attempt + 1}/{max_attempts})...")
                os.rename(PERSIST_DIR, backup_dir)
                print(f"✓ Folder lama berhasil direname ke '{backup_dir}'")
                
                try:
                    time.sleep(0.5)
                    shutil.rmtree(backup_dir)
                    print("✓ Folder backup berhasil dihapus.")
                except Exception as e:
                    print(f"⚠️ Folder backup tidak dapat dihapus sekarang: {e}")
                    print(f"   Folder '{backup_dir}' dapat dihapus manual nanti.")
                
                break
                
            except (PermissionError, OSError) as e:
                print(f"⚠️ Percobaan {attempt + 1} gagal: {e}")
                
                if attempt < max_attempts - 1:
                    print(f"   Menunggu {2 * (attempt + 1)} detik...")
                    force_cleanup_chroma()
                    time.sleep(2 * (attempt + 1))
                else:
                    print("\n❌ GAGAL: Tidak dapat mengakses folder chroma_db.")
                    print("   SOLUSI: Tutup SEMUA instance Python dan coba lagi.")
                    return 0
    
    print("\nMemulai proses RAG (Indexing) dari MongoDB...")
    all_documents = load_from_mongo()
    
    if not all_documents:
        print("Peringatan: Tidak ada dokumen yang ditemukan di MongoDB.")
        return 0
    
    print(f"Memecah {len(all_documents)} dokumen menjadi chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    texts = text_splitter.split_documents(all_documents)
    
    if not texts:
        print("Peringatan: Gagal memecah dokumen menjadi chunks.")
        return 0
    
    print(f"Membuat embeddings untuk {len(texts)} chunks dan menyimpan ke ChromaDB...")
    try:
        Chroma.from_documents(
            documents=texts, 
            embedding=embeddings, 
            persist_directory=PERSIST_DIR
        )
        print(f"✓ Vector store di '{PERSIST_DIR}' berhasil dibuat!")
        force_cleanup_chroma()
        return len(texts)
        
    except Exception as e:
        print(f"❌ Error saat membuat vector store: {e}")
        return 0

if __name__ == "__main__":
    mainrag()
    print("\nSistem RAG siap. Ketik 'exit' untuk keluar.")
    print("="*30)
    while True:
        q = input("Anda: ")
        if q.lower() == 'exit': break
        if q.lower() == 'reset':
            reset_memory()
            continue
        response = ask(q)
        print(f"\nAI: {response}")