# rag.py (Perbaikan Final - Menambahkan load_dotenv)
import os
from pymongo import MongoClient
from langchain_core.documents import Document
from dotenv import load_dotenv # <-- 1. TAMBAHKAN BARIS IMPORT INI

# Import Chroma and LangChain components
from langchain_chroma import Chroma
from langchain_community.llms import Ollama
from langchain_community.embeddings import OllamaEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

# --- Konfigurasi Global ---
load_dotenv() # <-- 2. TAMBAHKAN BARIS INI TEPAT DI SINI

VECTOR_STORE_PATH = "vector_store"
MONGO_URI = os.getenv("MONGO_URI") # Baris ini sekarang akan berhasil
MONGO_DB_NAME = "kui" 
MONGO_COLLECTION_NAME = "knowledgebase"

try:
    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    print("Ollama Embeddings (nomic-embed-text) dimuat.")
    llm = Ollama(model="gemma:2b")
    print("Ollama LLM (gemma:2b) dimuat.")
except Exception as e:
    print(f"Error inisialisasi model Ollama: {e}")
    embeddings = None
    llm = None

# --- Fungsi Loader untuk MongoDB ---
def load_from_mongo():
    print(f"Mencoba terhubung ke MongoDB: {MONGO_DB_NAME}/{MONGO_COLLECTION_NAME}")
    if not MONGO_URI:
        print("Error: MONGO_URI tidak ditemukan di environment variables.")
        return []
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
        
        mongo_docs = list(collection.find({}))
        client.close()
        
        langchain_docs = []
        for doc in mongo_docs:
            page_content = f"Topik Bahasan: {doc.get('topic')}\n\nInformasi Detail: {doc.get('content')}"
            metadata = {"source": "mongodb", "topic": doc.get('topic')}
            langchain_docs.append(Document(page_content=page_content, metadata=metadata))
            
        print(f"Berhasil memuat {len(langchain_docs)} dokumen dari MongoDB.")
        return langchain_docs
        
    except Exception as e:
        print(f"Error saat memuat dari MongoDB: {e}")
        return []

# ... (Sisa file Anda tidak perlu diubah sama sekali) ...

# --- Fungsi Utama: Membangun Vector Store ---
def mainrag():
    if embeddings is None:
        print("Embeddings gagal dimuat. Proses RAG dibatalkan.")
        return 0
        
    print("Memulai proses RAG (Indexing) dari MongoDB...")
    
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
    vector_store = Chroma.from_documents(
        documents=texts, 
        embedding=embeddings, 
        persist_directory=VECTOR_STORE_PATH
    )
    
    print("Vector store berhasil dibuat/diperbarui dari data MongoDB.")
    return len(texts)

# --- Fungsi Menjawab Pertanyaan ---
prompt_template_text = """
Anda adalah asisten AI yang informatif untuk website Universitas Padjadjaran (Unpad).
Tugas Anda adalah menjawab pertanyaan user HANYA berdasarkan konteks yang diberikan di bawah ini.
Jika jawaban tidak ada di dalam konteks, katakan "Maaf, saya tidak menemukan informasi tersebut di data saya."
Jangan mencoba menjawab di luar konteks.

Konteks:
{context}

Pertanyaan:
{question}

Jawaban Informatif:
"""

PROMPT_TEMPLATE = PromptTemplate(
    template=prompt_template_text, 
    input_variables=["context", "question"]
)

try:
    rag_chain = LLMChain(llm=llm, prompt=PROMPT_TEMPLATE)
except Exception as e:
    print(f"Error inisialisasi RAG chain: {e}")
    rag_chain = None

def get_rag_response(query: str) -> str:
    if rag_chain is None or embeddings is None:
        return "Error: Model AI (LLM atau Embeddings) gagal dimuat. Pastikan Ollama berjalan."
    try:
        vector_store = Chroma(
            persist_directory=VECTOR_STORE_PATH, 
            embedding_function=embeddings
        )
        retriever = vector_store.as_retriever(search_kwargs={"k": 4})
        relevant_docs = retriever.invoke(query)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
        response = rag_chain.invoke({"context": context, "question": query})
        
        return response.get('text', 'Terjadi kesalahan saat memproses jawaban.')
        
    except FileNotFoundError:
        return "Database pengetahuan (vector store) belum dibuat. Admin perlu menjalankan proses RAG."
    except Exception as e:
        print(f"Error di get_rag_response: {e}")
        return f"Terjadi kesalahan: {e}"