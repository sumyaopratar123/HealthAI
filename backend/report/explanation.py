
import os
import shutil
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate

# Project paths
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env.local", override=False)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Lazy initialization avoids loading models when the app starts
_embeddings = None


def get_embeddings():
    global _embeddings

    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    return _embeddings


def get_summary(file):
    temp_dir = None

    try:
        # Validate API key
        if not GROQ_API_KEY:
            return {
                "status": "error",
                "message": "GROQ_API_KEY is missing in backend/.env."
            }

        if file is None:
            return {
                "status": "error",
                "message": "Please upload a PDF report."
            }

        filename = (getattr(file, "filename", "") or "").lower()

        if not filename.endswith(".pdf"):
            return {
                "status": "error",
                "message": "Please upload a PDF file."
            }

        # Save uploaded PDF to a real temporary file.
        # This avoids Windows temporary-file permission problems.
        temp_dir = tempfile.mkdtemp(prefix="hospital_report_")
        pdf_path = os.path.join(temp_dir, "report.pdf")

        file.save(pdf_path)

        # Extract PDF text
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            return {
                "status": "error",
                "message": "No readable content was found in the PDF."
            }

        # Split long reports into manageable chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=2500,
            chunk_overlap=250
        )
        chunks = splitter.split_documents(documents)

        if not chunks:
            return {
                "status": "error",
                "message": "The uploaded PDF contains no readable text."
            }

        # Retrieve relevant sections from the report
        from langchain_chroma import Chroma

        vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=get_embeddings()
        )

        try:
            retriever = vectorstore.as_retriever(
                search_kwargs={"k": min(4, len(chunks))}
            )

            relevant_docs = retriever.invoke(
                "medical findings, test results, abnormal values, "
                "diagnosis, medications, recommendations and follow-up"
            )

            context = "\n\n".join(
                doc.page_content for doc in relevant_docs
            )

        finally:
            vectorstore.delete_collection()

        if not context.strip():
            context = "\n\n".join(
                doc.page_content for doc in chunks[:4]
            )

        # Use the Groq model configured in the environment.
        # GROQ_MODEL must be an active model ID from Groq Console.
        model_name = os.getenv("GROQ_MODEL")

        if not model_name:
            return {
                "status": "error",
                "message": (
                    "GROQ_MODEL is missing in backend/.env. "
                    "Set it to an active chat model ID from "
                    "https://console.groq.com/docs/models"
                )
            }

        llm = ChatGroq(
            model=model_name,
            groq_api_key=GROQ_API_KEY,
            temperature=0.2,
            max_tokens=1500
        )

        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a careful medical report explanation assistant. "
                "Explain the uploaded report in clear, simple English. "
                "Summarize key findings, abnormal results, values explicitly "
                "mentioned in the report, and recommended follow-up if stated. "
                "Do not invent results, diagnoses, medications, or reference "
                "ranges. Explain that a doctor must interpret the report "
                "alongside the patient's symptoms and medical history. "
                "Do not provide a definitive diagnosis."
            ),
            (
                "human",
                "Explain this medical report using only the information "
                "supported by the following report excerpts:\n\n{context}\n\n"
                "Organize the response into:\n"
                "1. Simple summary\n"
                "2. Important findings\n"
                "3. Values that may need medical review\n"
                "4. Suggested questions for the doctor\n"
                "5. Important limitations"
            )
        ])

        response = (prompt | llm).invoke({"context": context})
        summary = response.content

        if isinstance(summary, list):
            summary = "\n".join(
                item.get("text", "") if isinstance(item, dict)
                else str(item)
                for item in summary
            )

        summary = str(summary).strip()

        if not summary:
            return {
                "status": "error",
                "message": "The AI returned an empty summary. Please retry."
            }

        return {
            "status": "success",
            "summary": summary
        }

    except Exception as e:
        print(f"Report summary error: {type(e).__name__}: {e}")

        return {
            "status": "error",
            "message": (
                "Could not generate the report summary. "
                "Check the backend terminal for the exact error."
            )
        }

    finally:
        if temp_dir and os.path.isdir(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
