# ==============================================================================
# FILE: rag.py
# VERSI: 5.3 (English Output Enforced for International Students)
# ==============================================================================

import os
import re
import shutil
import gc
import time
import json
import logging
from contextlib import contextmanager
from pymongo import MongoClient
from langchain_core.documents import Document
from dotenv import load_dotenv
from datetime import datetime

# --- LANGCHAIN & AI ---
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.chains import LLMChain

# ==============================================================================
# 1. SETUP & KONFIGURASI
# ==============================================================================

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [RAG] - %(message)s')
logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
MONGO_COLLECTION_NAME = "knowledgebase"

PERSIST_DIR = "chroma_db"
EMBED_MODEL = "models/text-embedding-004"
LLM_MODEL = "gemini-flash-latest"

if not GOOGLE_API_KEY:
    logger.error("CRITICAL: GOOGLE_API_KEY is missing!")

try:
    embeddings = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL, google_api_key=GOOGLE_API_KEY)
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.3, google_api_key=GOOGLE_API_KEY)
    llm_strict = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.0, google_api_key=GOOGLE_API_KEY)
except Exception as e:
    logger.error(f"Error initializing models: {e}")
    embeddings = None
    llm = None
    llm_strict = None

# ==============================================================================
# 2. VECTOR DATABASE MANAGEMENT
# ==============================================================================

@contextmanager
def get_chroma_db():
    db = None
    try:
        if os.path.exists(PERSIST_DIR):
            db = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
        yield db
    finally:
        if db:
            del db
            gc.collect()

def force_cleanup_chroma():
    gc.collect()

# ==============================================================================
# 3. SMART FORMATTING
# ==============================================================================

cleaning_template = """
You are a Specialized Document Formatter AI.
Your task is to take RAW TEXT extracted from a PDF and restructure it into clean MARKDOWN.

CRITICAL INSTRUCTION FOR TABLES:
The input text MAY ALREADY CONTAIN Markdown Tables (starting with | ... |). 
**DO NOT DESTROY THEM.** You must preserve them or fix their alignment if broken.

INSTRUCTIONS:
1. **Preserve Tables:** If you see lines with pipes (|), keep them as valid Markdown Tables.
2. **Lists:** Fix broken list items (1., a., -) into proper Markdown lists.
3. **Headings:** Use # for titles and ## for sections.
4. **Garbage:** Remove random headers/footers (e.g., "Page 1 of 5").
5. **Content:** Do NOT summarize. Keep all numbers, dates, and names exactly as is.

RAW TEXT:
{raw_text}

CLEAN MARKDOWN OUTPUT:
"""
cleaning_prompt = PromptTemplate(input_variables=["raw_text"], template=cleaning_template)
cleaning_chain = LLMChain(llm=llm_strict, prompt=cleaning_prompt)

def smart_clean_text(raw_text: str) -> str:
    if not raw_text or not llm_strict: 
        return raw_text or ""

    CHUNK_SIZE = 12000 
    total_len = len(raw_text)
    
    if total_len <= CHUNK_SIZE:
        try:
            res = cleaning_chain.invoke({"raw_text": raw_text})
            return res['text']
        except Exception:
            return raw_text

    logger.info(f"   [CLEAN] Teks panjang ({total_len} chars). Memecah...")
    chunks = [raw_text[i:i+CHUNK_SIZE] for i in range(0, total_len, CHUNK_SIZE)]
    cleaned_parts = []
    
    for chunk in chunks:
        try:
            res = cleaning_chain.invoke({"raw_text": chunk})
            cleaned_parts.append(res['text'])
            time.sleep(1)
        except Exception:
            cleaned_parts.append(chunk)

    return "\n\n".join(cleaned_parts)

# ==============================================================================
# 4. RERANKING ENGINE
# ==============================================================================

def rerank_with_gemini(query: str, docs: list, top_k: int = 3):
    if not docs: return [], "QUERY"
    
    logger.info(f"⚖️ Reranking {len(docs)} candidates...")
    
    doc_options = ""
    for i, d in enumerate(docs):
        content = d.page_content[:450].replace("\n", " ") 
        doc_options += f"Doc ID {i}: {content}\n\n"

    rerank_msg = f"""
    You are an Intelligent Relevance Evaluator.
    Analyze the USER QUESTION and the candidate DOCUMENT LIST.

    USER QUESTION: "{query}"

    DOCUMENT LIST:
    {doc_options}

    YOUR TASK:
    1. **Check Intent:** CHAT (Greeting) vs QUERY (Information).
    2. **Rerank (If QUERY):** Select document IDs relevant to the answer.

    OUTPUT FORMAT:
    - If CHAT: "INTENT:CHAT"
    - If QUERY with valid docs: JSON list e.g., [0, 2]
    - If QUERY but NO valid docs: "NONE"

    OUTPUT:
    """
    
    try:
        response = llm_strict.invoke(rerank_msg)
        content = response.content.strip()
        logger.info(f"Rerank Output: {content}")

        if "INTENT:CHAT" in content:
            return [], "CHAT"
        
        if "NONE" in content:
            return [], "QUERY"

        content = content.replace("```json", "").replace("```", "").strip()
        selected_indices = json.loads(content)
        
        if not isinstance(selected_indices, list):
            return docs[:top_k], "QUERY"
            
        reranked_docs = []
        for idx in selected_indices:
            if isinstance(idx, int) and 0 <= idx < len(docs):
                reranked_docs.append(docs[idx])
        
        return reranked_docs[:top_k], "QUERY"

    except Exception as e:
        logger.warning(f"Rerank fallback: {e}")
        return docs[:top_k], "QUERY"

# ==============================================================================
# 5. RETRIEVAL & GENERATION (UPDATED PROMPT FOR ENGLISH OUTPUT)
# ==============================================================================

qa_template = """
You are the **International Student AI Assistant for Universitas Padjadjaran (Unpad)**.
Your persona is professional, warm, academic, and helpful.

YOUR MISSION:
Answer the user's question naturally using the provided DOCUMENT CONTEXT and CHAT HISTORY.

### **GUIDELINES:**

1. **Language Requirement (CRITICAL):** - **ALWAYS ANSWER IN ENGLISH.**
   - Even if the user asks in Indonesian or the documents are in Indonesian, you MUST translate and answer in English.
   - If the user greets in Indonesian, reply in English politely.

2. **Table Handling (CRITICAL):** - ALWAYS use **Markdown Tables** for structured data (Schedules, Courses, Fees).
   - Format:
     | Header 1 | Header 2 |
     | -------- | -------- |
     | Data 1   | Data 2   |
   - **DO NOT** use HTML tags like <table>, <tr>, <td>.

3. **Formatting:**
   - Use **Bold** for importance.
   - Use - Bullet points for lists.
   - Use `### Heading` for sections.

### **INPUT DATA:**

**CHAT HISTORY:**
{chat_history}

**DOCUMENT CONTEXT:**
{context}

**USER QUESTION:** {question}

### **YOUR ANSWER (MARKDOWN ENGLISH):**
"""
qa_prompt = ChatPromptTemplate.from_template(qa_template)

def ask(question: str, history: list = []) -> str:
    if not llm or not embeddings:
        return "⚠️ AI System is initializing. Please wait a moment."
    
    try:
        chat_history_str = ""
        recent_history = history[-5:] 
        for msg in recent_history:
            role = "Human" if msg.get('role') == 'user' else "AI"
            content = msg.get('content', '')
            chat_history_str += f"{role}: {content}\n"

        with get_chroma_db() as db:
            if not db:
                return "Knowledge database is not ready. Please perform 'Update RAG' in the admin panel."
            
            retriever = db.as_retriever(search_kwargs={"k": 8})
            initial_docs = retriever.invoke(question)
            
            final_docs, intent = rerank_with_gemini(question, initial_docs, top_k=3)
            
            context_text = ""
            if intent == "QUERY" and not final_docs:
                context_text = "" 
            elif final_docs:
                snippets = []
                for d in final_docs:
                    txt = re.sub(r"\s+", " ", d.page_content).strip()
                    snippets.append(f"[Source: {d.metadata.get('topic', 'General')}]\n{txt}")
                context_text = "\n\n".join(snippets)

            chain = qa_prompt | llm
            response = chain.invoke({
                "chat_history": chat_history_str,
                "context": context_text,
                "question": question
            })
            
            return response.content.strip()
            
    except Exception as e:
        logger.error(f"Ask Error: {e}")
        return f"System Error: {str(e)}"

# ==============================================================================
# 6. INDEXING ENGINE
# ==============================================================================

def load_from_mongo():
    if not MONGO_URI: return []
    
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    collection = db[MONGO_COLLECTION_NAME]

    cursor = collection.find({"status": "ACTIVE"})
    
    docs = []
    count = 0
    for doc in cursor:
        combined_text = f"Topic: {doc['topic']}\nCategory: {doc['category']}\nContent:\n{doc['content']}"
        
        docs.append(Document(
            page_content=combined_text,
            metadata={
                "id": str(doc["_id"]),
                "topic": doc.get("topic", "No Topic"),
                "category": doc.get("category", "General")
            }
        ))
        count += 1

    collection.update_many({}, {"$set": {"is_sync": True}})
    
    client.close()
    logger.info(f"✅ Loaded {count} ACTIVE documents from MongoDB.")
    return docs

def mainrag():
    logger.info("🚀 Starting RAG Indexing Process...")

    if os.path.exists(PERSIST_DIR):
        try:
            shutil.rmtree(PERSIST_DIR, ignore_errors=True)
            logger.info("🧹 Old Vector Database wiped.")
        except Exception as e:
            logger.error(f"⚠️ Failed to wipe DB: {e}")
    
    docs = load_from_mongo()
    if not docs:
        logger.warning("MongoDB is empty or no ACTIVE docs. ChromaDB will be empty.")
        return "Indexing Complete (No Data)"

    logger.info(f"Elementing {len(docs)} documents...")
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    
    Chroma.from_documents(
        documents=splits, 
        embedding=embeddings, 
        persist_directory=PERSIST_DIR
    )
    
    logger.info("✅ New Vector Database created successfully!")
    return "Indexing Complete"

def reset_memory():
    force_cleanup_chroma()
    if os.path.exists(PERSIST_DIR):
        try:
            shutil.rmtree(PERSIST_DIR, ignore_errors=True)
            logger.info("✅ Vector Database cleared.")
        except Exception as e:
            logger.error(f"Failed to clear database: {e}")