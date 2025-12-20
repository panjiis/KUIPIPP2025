import os
import re
import shutil
import gc
import time
import json
from contextlib import contextmanager
from pymongo import MongoClient
from langchain_core.documents import Document
from dotenv import load_dotenv
from datetime import datetime

# --- Import Library LangChain & Google GenAI ---
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Pinecone

# --- Konfigurasi Global ---
load_dotenv() 

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PERSIST_DIR = "chroma_db"
EMBED_MODEL = "models/text-embedding-004"
LLM_MODEL = "gemini-flash-latest"  

# MongoDB Config
MONGO_URI = os.getenv("MONGO_URI") 
MONGO_DB_NAME = "kui" 
MONGO_COLLECTION_NAME = "knowledgebase"

# --- Inisialisasi Model ---
try:
    embeddings = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL, google_api_key=GOOGLE_API_KEY)
    
    # LLM Utama (Chat)
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.3, google_api_key=GOOGLE_API_KEY)
    
    # LLM Reranker (Relevance Judge) - Temperature 0 wajib agar konsisten
    llm_reranker = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0, google_api_key=GOOGLE_API_KEY)
    
except Exception as e:
    print(f"⚠️ Kesalahan inisialisasi model: {e}")
    embeddings = None
    llm = None
    llm_reranker = None

# --- Context Manager Database ---
@contextmanager
def get_chroma_db():
    db = None
    try:
        db = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
        yield db
    finally:
        if db:
            try:
                # Force cleanup connection
                if hasattr(db, '_client'): db._client.clear_system_cache()
            except: pass
            del db
            gc.collect()

# --- Helper Functions ---
def clean_context(context: str) -> str:
    context = re.sub(r"\s+", " ", context)
    return context.strip()

# --- FITUR 1: LLM Reranking (Context Awareness) ---
def rerank_with_gemini(query: str, docs: list, top_k: int = 3):
    """
    Menggunakan LLM untuk menilai ulang relevansi dokumen yang diambil oleh Vector Search.
    """
    if not docs: return []
    
    print(f"⚖️ Melakukan Reranking pada {len(docs)} dokumen...")
    
    # Format input untuk LLM
    doc_options = ""
    for i, d in enumerate(docs):
        # Ambil snippet konten (batasi 500 char agar prompt tidak kepanjangan)
        content = d.page_content[:500].replace("\n", " ")
        doc_options += f"Doc ID {i}: {content}\n\n"

    # Prompt Strict JSON
    rerank_prompt = f"""
    You are a relevance grader. I will provide a Query and a list of Document Snippets.
    Your task is to identify which documents are RELEVANT to the Query.
    
    Query: "{query}"
    
    Documents:
    {doc_options}
    
    INSTRUCTIONS:
    1. Select the IDs of documents that contain the answer.
    2. Sort them by relevance (most relevant first).
    3. Return ONLY a JSON array of integers. No text, no markdown.
    
    Example Output: [2, 0, 4]
    """
    
    try:
        response = llm_reranker.invoke(rerank_prompt)
# Ganti dengan logika pengecekan tipe data
        content = response.content
        if isinstance(content, list):
            # Jika list, gabungkan isinya atau ambil teksnya saja
            content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in content])
        content = content.strip()
        
        # Bersihkan format jika LLM nakal menambahkan markdown
        content = content.replace("```json", "").replace("```", "").strip()
        
        selected_indices = json.loads(content)
        
        if not isinstance(selected_indices, list):
            return docs[:top_k] # Fallback
            
        print(f"✓ Dokumen Terpilih (ID): {selected_indices}")
        
        reranked_docs = []
        for idx in selected_indices:
            if isinstance(idx, int) and 0 <= idx < len(docs):
                reranked_docs.append(docs[idx])
        
        # Jika hasil rerank kosong (LLM bilang tidak ada yg relevan),
        # kembalikan 1 dokumen teratas dari vector search sebagai cadangan, 
        # atau list kosong jika ingin strict. Di sini kita fallback ke top-1.
        if not reranked_docs:
            print("⚠️ LLM merasa tidak ada yang relevan. Fallback ke Top-1 Vector.")
            return docs[:1]
            
        return reranked_docs[:top_k]

    except Exception as e:
        print(f"⚠️ Reranking Error: {e}. Menggunakan hasil standard.")
        return docs[:top_k]

# --- Prompt Template Utama ---
template = """
You are a helpful AI assistant for a university (Skripsi Bot).
Answer the user's question based strictly on the provided CONTEXT.

INSTRUCTIONS:
1. Use the CHAT HISTORY to understand references (e.g., "it", "that").
2. If the answer is not in the CONTEXT, explicitly say you don't know based on the data.
3. Answer in the same language as the User Question.

CHAT HISTORY:
{chat_history}

CONTEXT (Reference Data):
{context}

USER QUESTION:
{question}

ANSWER:
"""
prompt = ChatPromptTemplate.from_template(template)

# --- FUNGSI UTAMA CHAT (Stateless) ---
def ask(question: str, history: list = []) -> str:
    """
    question: Pertanyaan user saat ini
    history: List of dict [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]
    """
    if not llm or not embeddings:
        return "⚠️ Sistem AI belum siap (Model Error)."
    
    try:
        # 1. Format Chat History dari format List dict ke String
        # Kita ambil 3 turn terakhir saja agar prompt tidak penuh
        chat_history_str = ""
        recent_history = history[-6:] # 3 pasang percakapan terakhir
        for msg in recent_history:
            role = "Human" if msg.get('role') == 'user' else "AI"
            content = msg.get('content', '')
            chat_history_str += f"{role}: {content}\n"
        
        if not chat_history_str: chat_history_str = "No previous history."

        with get_chroma_db() as db:
            # 2. Retrieval (Ambil kandidat lebih banyak, misal 10)
            retriever = db.as_retriever(search_kwargs={"k": 8})
            initial_docs = retriever.invoke(question)
            
            # 3. Reranking (Filter jadi 3 terbaik dengan LLM)
            final_docs = rerank_with_gemini(question, initial_docs, top_k=3)
            
            if not final_docs:
                return "Maaf, data terkait tidak ditemukan dalam knowledge base."

            # 4. Format Context
            snippets = []
            for d in final_docs:
                src = d.metadata.get("topic", "General")
                txt = clean_context(d.page_content)
                snippets.append(f"[Topik: {src}] {txt}")
            
            context_text = "\n\n".join(snippets)

            # 5. Generate Answer
            chain = prompt | llm
            inputs = {
                "chat_history": chat_history_str,
                "context": context_text,
                "question": question
            }
            
            response = chain.invoke(inputs)
            # Ganti response.content.strip() dengan penanganan yang aman
            final_content = response.content
            if isinstance(final_content, list):
                final_content = " ".join([str(p) for p in final_content])
            return final_content.strip()
            
    except Exception as e:
        print(f"❌ Error ask logic: {e}")
        return "Terjadi kesalahan sistem saat memproses jawaban."

# --- Indexing Functions (Tetap sama, dirapikan sedikit) ---
def force_cleanup_chroma():
    gc.collect()

def load_from_mongo():
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    collection = db[MONGO_COLLECTION_NAME]

    # 1. Ambil data yang ACTIVE saja untuk diproses oleh RAG
    # (Ini tetap seperti semula agar dokumen nonaktif tidak bisa ditanya oleh user)
    cursor = collection.find({"status": "ACTIVE"})
    
    docs = []
    active_ids = []
    for doc in cursor:
        active_ids.append(doc["_id"])
        docs.append(Document(
            page_content=f"Topic: {doc['topic']}\nCategory: {doc['category']}\nContent: {doc['content']}",
            metadata={
                "id": str(doc["_id"]),
                "topic": doc["topic"],
                "category": doc["category"]
            }
        ))

    # 2. LOGIKA BARU: Set 'is_sync: True' untuk SEMUA data yang belum sinkron
    # Baik itu data ACTIVE yang baru masuk, maupun INACTIVE yang baru saja dinonaktifkan.
    result = collection.update_many(
        {"is_sync": False}, 
        {"$set": {"is_sync": True}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Berhasil sinkronisasi {result.modified_count} data (termasuk data nonaktif).")

    client.close()
    return docs

def mainrag():
    # PERINGATAN: Ini adalah "Full Rebuild Strategy".
    # Jika data sangat banyak (>500 dokumen), embed ulang ke Google akan tetap memakan waktu.
    # Untuk mempercepat drastis, kita harus beralih ke "Incremental Strategy" (lebih kompleks).
    # Untuk saat ini, optimasi Mongo di atas sudah mengurangi beban Database.
    
    if os.path.exists(PERSIST_DIR):
        try:
            shutil.rmtree(PERSIST_DIR, ignore_errors=True)
            print("🧹 Cache lama dibersihkan.")
        except Exception as e:
            print(f"⚠️ Gagal menghapus cache lama: {e}")
    
    docs = load_from_mongo()
    if not docs:
        print("MongoDB kosong atau tidak ada data ACTIVE.")
        return

    print(f"🚀 Memulai Embedding {len(docs)} dokumen ke Google AI...")
    
    # Batch processing bisa membantu stabilitas, tapi Chroma.from_documents sudah menanganinya.
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    
    Chroma.from_documents(documents=splits, embedding=embeddings, persist_directory=PERSIST_DIR)
    print("✅ Indexing selesai!")

# Reset memory dihapus karena sekarang stateless
def reset_memory():
    pass