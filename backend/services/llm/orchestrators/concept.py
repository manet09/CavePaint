from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def generate_video_concept(db: Session, raw_research: str) -> str:
    system_prompt = (
        "You are an expert creative director. Your task is to analyze the provided raw research notes "
        "and outline a highly structured, cinematic, modern, and deadpan stylistic video theme."
    )
    user_content = f"Raw Research:\n{raw_research}"
    return generate_text(db, system_prompt, user_content)
