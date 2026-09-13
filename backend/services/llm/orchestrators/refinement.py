import json
import logging
from sqlalchemy.orm import Session
from backend.services.llm.client import generate_text

logger = logging.getLogger(__name__)

def refine_scene_prompt(
    db: Session, 
    existing_prompt: str, 
    existing_negative_prompt: str, 
    user_instruction: str, 
    global_style: str, 
    video_concept: str
) -> dict:
    """
    Takes the current positive and negative prompts of a scene, applies user instructions 
    and global style constraints, and returns a refined JSON containing both updated fields.
    """
    
    system_prompt = (
        "You are an expert prompt engineer specialized in local image synthesis (Stable Diffusion/Flux).\n"
        "Your task is to modify an existing image generation prompt and its negative constraints "
        "based on specific user instructions, while strictly maintaining the overarching project aesthetic.\n\n"
        
        "CRITICAL STYLE CONSTRAINT:\n"
        "You must preserve the core visual engine identity unless explicitly told otherwise:\n"
        "- Minimalist 2D flat vector stickman doodle art with bold thick black marker outlines.\n"
        "- Characters must be simple stick figures (round head, large circle eyes, thin stick limbs) - NO realistic muscles, NO comic detail.\n"
        "- Vibrant flat solid colors and seamless studio backgrounds.\n"
        "- STRICTLY NO text, NO words, NO letters, NO labels on images.\n"
        "- Keep prompts concise, punchy, and natural (under 50 words).\n"
        "- Preserve the visual archetype of the shot and metaphor alignment with script.\n"
        "- NO gradients, NO 3D shading, NO complex photorealism.\n\n"
        
        "OUTPUT RULE:\n"
        "You must output a strictly valid JSON object matching this schema exactly. "
        "Do not include any conversational text, explanations, or markdown blocks.\n"
        "{\n"
        "  \"image_prompt_english\": \"The fully rewritten and enhanced positive prompt string incorporating the user modifications.\",\n"
        "  \"negative_prompt_english\": \"The updated or preserved negative constraints string.\"\n"
        "}"
    )
    
    user_content = (
        f"--- GLOBAL CONTEXT ---\n"
        f"Video Concept: {video_concept}\n"
        f"Global Illustration Style Guide: {global_style}\n\n"
        f"--- CURRENT STATE ---\n"
        f"Current Positive Prompt: {existing_prompt}\n"
        f"Current Negative Prompt: {existing_negative_prompt}\n\n"
        f"--- USER MODIFICATION REQUEST ---\n"
        f"Instruction: {user_instruction}\n\n"
        f"Apply the modification request intelligently. Ensure the positive prompt remains descriptive "
        "for the image generator, and verify that the negative prompt protects against unwanted artifacts."
    )
    
    # Execute text generation using our unified, dynamic client driver in JSON mode
    raw_response = generate_text(db, system_prompt, user_content, json_mode=True)
    
    try:
        refined_data = json.loads(raw_response)
        # Ensure keys exist with default fallbacks if the LLM misses a property
        return {
            "image_prompt_english": refined_data.get("image_prompt_english", existing_prompt).strip(),
            "negative_prompt_english": refined_data.get("negative_prompt_english", existing_negative_prompt).strip()
        }
    except Exception as e:
        logger.error(f"Failed to parse prompt refinement JSON payload. Raw response: {raw_response}. Error: {e}")
        # Safe fallback: return original state if parsing encounters an edge-case failure
        return {
            "image_prompt_english": existing_prompt,
            "negative_prompt_english": existing_negative_prompt
        }