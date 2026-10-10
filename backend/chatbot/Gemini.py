
import os
import logging
from dotenv import load_dotenv
from google import genai
from chatbot.data import data

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

logger = logging.getLogger(__name__)
MODEL_NAME = "gemini-3.8-flash"


def gemini(prompt, retries=1):
    if not isinstance(prompt, str) or not prompt.strip():
        return "Please enter a message."

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is missing.")
        return "AI service configuration is missing. Please contact support."

    try:
        client = genai.Client(api_key=api_key)

        history_lines = []
        if isinstance(data, list):
            for item in data[-4:]:
                if not isinstance(item, dict):
                    continue
                parts = item.get("parts", [])
                if isinstance(parts, list) and parts:
                    history_lines.append(
                        f"{item.get('role', 'user')}: {str(parts[0])[:500]}"
                    )

        context = "\n".join(history_lines)

        full_prompt = (
            "You are a concise, friendly healthcare information assistant. "
            "Answer clearly and briefly. Do not diagnose or replace a doctor. "
            "For emergencies, advise immediate medical care.\n\n"
        )

        if context:
            full_prompt += f"Recent conversation:\n{context}\n\n"

        full_prompt += f"User: {prompt.strip()}"

        response = client.interactions.create(
            model=MODEL_NAME,
            input=full_prompt
        )

        answer = getattr(response, "output_text", None)
        if answer and answer.strip():
            return answer.strip()

        return "I couldn't generate a response. Please try again."

    except Exception:
        logger.exception("Gemini chatbot request failed")
        return "AI response failed. Please try again."
