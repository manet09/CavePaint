from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def generate_narrative_script(db: Session, raw_research: str, video_concept: str) -> str:
    system_prompt = (
        "You are a professional screenwriter. Based on the raw research and the provided video concept, "
        "write a flowing narrative script. The entire script MUST be completely translated into Khmer, "
        "maintaining appropriate pacing, formatting, and engaging flow suitable for a cinematic video."
    )
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}"
    )
    return generate_text(db, system_prompt, user_content)
