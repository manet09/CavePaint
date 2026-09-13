from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def generate_illustration_style(db: Session, raw_research: str, video_concept: str, script_narrative: str) -> str:
    system_prompt = (
        "You are a lead visual director for an educational animated explainer series. "
        "Based on the provided research, video concept, and script narrative, "
        "output a precise stylistic directive tailored for a local Flux/Stable Diffusion 2D vector pipeline.\n"
        "CRITICAL AESTHETIC CONSTRAINT: Enforce minimalist 2D flat vector stickman doodle illustration, "
        "bold thick black marker outlines, vibrant flat solid colors, zero shading, zero gradients, and seamless studio backdrops. "
        "Characters must be simple cute stick figures with round heads, large white circle eyes with black dot pupils, and thin stick limbs (NO realistic muscles, NO comic detail). "
        "STRICTLY NO text, NO words, NO labels on any graphics. Emphasize diverse shot types: visual diagrams, tool close-ups, wildlife, and wide scale contrasts. "
        "Keep prompts concise (30-50 words), natural, and free of proper-noun channel names."
    )
    user_content = (
        f"Raw Research:\n{raw_research}\n\n"
        f"Video Concept:\n{video_concept}\n\n"
        f"Script Narrative:\n{script_narrative}"
    )
    return generate_text(db, system_prompt, user_content)
