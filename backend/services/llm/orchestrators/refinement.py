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


def refine_scene_prompt_and_script(
    db: Session,
    existing_prompt: str,
    existing_narration: str,
    existing_negative_prompt: str,
    user_instruction: str,
    global_style: str = "",
    video_concept: str = "",
    theme_era: str = "",
    scene_staging: str = "studio"
) -> dict:
    """
    Intelligent Scene Copilot: takes the current scene's image prompt, Khmer voiceover narration,
    and negative constraints, applies user adjustment instructions, and updates both the visual
    prompt and Khmer script while strictly adhering to Whatly stickman style guidelines.
    """
    system_prompt = (
        "You are an expert Creative Director & Prompt Engineer for YouTube explainer animations (Whatly style).\n"
        "Your role is to iteratively refine a video scene's visual prompt and its corresponding Khmer voiceover script "
        "based on natural language user feedback.\n\n"
        
        "CRITICAL VISUAL STYLE GUIDELINES (STICKMAN DOODLE):\n"
        "- Minimalist 2D flat vector stickman doodle illustration with clean thick bold black marker outlines.\n"
        "- Stick figures have round heads, large simple circle eyes, and thin stick limbs. Zero muscular anatomy, zero comic book cross-hatching.\n"
        "- Flat solid colors, pure minimalist shapes, seamless solid background (studio white or solid theme color).\n"
        "- STRICTLY NO text, NO words, NO letters, NO labels, NO watermarks on the image.\n"
        "- Keep prompts concrete and physical (under 55 words). Describe concrete actions, props, and setting.\n"
        "- NO gradients, NO 3D render, NO photorealism.\n\n"
        
        "SCRIPT & NARRATION GUIDELINES (KHMER):\n"
        "- If the user's adjustment modifies what happens in the scene or asks to change the voiceover, adjust the Khmer narration accordingly.\n"
        "- Keep the Khmer voiceover concise, cinematic, natural, and rhythmically paced for narration.\n"
        "- Ensure the Khmer sentence terminates with '។'.\n"
        "- If the user's instruction only affects visual framing/camera/colors, preserve the existing Khmer voiceover intact.\n\n"
        
        "OUTPUT SCHEMA (STRICT JSON):\n"
        "You must output ONLY a valid JSON object matching this schema exactly with no markdown blocks or surrounding text:\n"
        "{\n"
        "  \"image_prompt_english\": \"Refined positive English prompt for Google Flow / SD\",\n"
        "  \"narration_khmer\": \"Refined or preserved Khmer voiceover sentence ending with ។\",\n"
        "  \"negative_prompt_english\": \"Updated or preserved negative constraints\",\n"
        "  \"change_summary\": \"A short, friendly 1-2 sentence English explanation of what was adjusted\"\n"
        "}"
    )

    user_content = (
        f"--- CONTEXT ---\n"
        f"Video Concept: {video_concept or 'Educational Explainer'}\n"
        f"Era: {theme_era or 'Modern'}\n"
        f"Staging Mode: {scene_staging}\n"
        f"Global Style Guide: {global_style or '2D flat vector stickman illustration, clean black outlines, solid color fills, seamless pure white background'}\n\n"
        f"--- CURRENT SCENE STATE ---\n"
        f"Current Visual Prompt (English): {existing_prompt or '(none)'}\n"
        f"Current Voiceover (Khmer): {existing_narration or '(none)'}\n"
        f"Current Exclusions (Negative): {existing_negative_prompt or '(none)'}\n\n"
        f"--- USER ADJUSTMENT REQUEST ---\n"
        f"Instruction: {user_instruction}\n\n"
        f"Update the prompt and voiceover script intelligently to reflect the user's idea."
    )

    raw_response = generate_text(db, system_prompt, user_content, json_mode=True)

    try:
        refined_data = json.loads(raw_response)
        khmer_out = refined_data.get("narration_khmer", existing_narration or "").strip()
        if khmer_out and not khmer_out.endswith("។"):
            khmer_out += "។"

        return {
            "image_prompt_english": refined_data.get("image_prompt_english", existing_prompt).strip(),
            "narration_khmer": khmer_out,
            "negative_prompt_english": refined_data.get("negative_prompt_english", existing_negative_prompt).strip(),
            "change_summary": refined_data.get("change_summary", "Refined scene prompt and script according to your instructions.").strip()
        }
    except Exception as e:
        logger.error(f"Failed to parse flow adjust JSON. Raw response: {raw_response}. Error: {e}")
        return {
            "image_prompt_english": existing_prompt,
            "narration_khmer": existing_narration,
            "negative_prompt_english": existing_negative_prompt,
            "change_summary": "Applied instruction to scene."
        }