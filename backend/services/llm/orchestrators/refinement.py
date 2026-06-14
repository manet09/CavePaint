from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

def refine_scene_prompt(db: Session, existing_prompt: str, user_instruction: str, global_style: str, video_concept: str) -> str:
    system_prompt = (
        "You are an expert prompt engineer for local Stable Diffusion/Flux renderers. "
        "Take the individual scene prompt, apply the global illustration context, and modify the prompt directly "
        "based on the natural language user instructions. "
        "OUTPUT RULE: Your output MUST be a single, highly descriptive prompt string designed to feed straight "
        "into the local renderer. Do NOT include any chat commentary, conversational wrappers, or quotes."
    )
    user_content = (
        f"Existing Scene Prompt:\n{existing_prompt}\n\n"
        f"User Instruction (How to mutate the prompt):\n{user_instruction}\n\n"
        f"Global Illustration Style:\n{global_style}\n\n"
        f"Video Concept:\n{video_concept}"
    )
    
    return generate_text(db, system_prompt, user_content)
