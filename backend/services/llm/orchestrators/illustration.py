from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def generate_illustration_style(db: Session, raw_research: str, video_concept: str, script_narrative: str) -> str:
    system_prompt = (
        "You are a lead art director. Based on the provided research, video concept, and script narrative, "
        "output a precise stylistic directive tailored for an image generation pipeline.\n"
        "CRITICAL AESTHETIC CONSTRAINT: You must enforce the following core aesthetic: "
        "'Simple 2D flat vector stickman art style, minimalist stickman character, bold clean outlines, "
        "set against uniform plain solid color backdrops to emphasize absolute isolation.'"
    )
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}\n\n"
        f"Script Narrative:\n{script_narrative}"
    )
    return generate_text(db, system_prompt, user_content)
