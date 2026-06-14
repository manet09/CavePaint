from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def generate_vocal_parameters(db: Session, raw_research: str, video_concept: str, script_narrative: str) -> str:
    system_prompt = (
        "You are a professional audio engineer and voice director. Build an acoustic parameter blueprint "
        "dictating the narration tone, clear diction, and spatial requirements based on the provided inputs. "
        "Ensure requirements specify high-quality acoustic constraints (e.g., dry studio mix, zero background echo)."
    )
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}\n\n"
        f"Script Narrative:\n{script_narrative}"
    )
    return generate_text(db, system_prompt, user_content)
