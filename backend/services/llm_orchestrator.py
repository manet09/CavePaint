import os
from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..database import Setting
import google.generativeai as genai

def generate_field_content(db: Session, field_name: str, context: str) -> str:
    # 1. Fetch settings from DB
    setting = db.query(Setting).first()
    
    if setting:
        provider = setting.active_provider or "gemini"
        slot = setting.active_slot or 1
    else:
        provider = "gemini"
        slot = 1
        
    # 2. Resolve Environment
    if provider == "gemini":
        env_var = f"GEMINI_KEY_{slot}"
        api_key = os.getenv(env_var)
        if not api_key:
            raise HTTPException(status_code=500, detail=f"LLM Configuration Error: '{env_var}' is not populated in your environment. Please define {env_var} in your .env or .env.local file.")
            
        genai.configure(api_key=api_key)
        
        system_prompt = get_system_prompt_for_field(field_name)
        
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f"{system_prompt}\n\nContext:\n{context}"
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
            
    elif provider == "groq":
        env_var = f"GROQ_KEY_{slot}"
        api_key = os.getenv(env_var)
        if not api_key:
            raise HTTPException(status_code=500, detail=f"LLM Configuration Error: '{env_var}' is not populated in your environment. Please define {env_var} in your .env or .env.local file.")
            
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            system_prompt = get_system_prompt_for_field(field_name)
            
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context:\n{context}"}
                ]
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
            
    else:
        raise HTTPException(status_code=500, detail=f"Unknown LLM Provider: {provider}")

def get_system_prompt_for_field(field_name: str) -> str:
    # Instruction prompts enforcing minimalist 2D flat vector stickman doodle art with diverse visual archetypes.
    base_style = (
        "CRITICAL STYLE ENFORCEMENT: All visual descriptions must enforce minimalist 2D flat vector stickman doodle art, "
        "bold thick black marker outlines, flat solid colors, and seamless studio backgrounds. Zero shading, zero gradients, zero photorealism. "
        "Characters must be simple cute stick figures with round heads, large white circle eyes, and thin black stick limbs (NO realistic muscles, NO comic detail). "
        "STRICTLY NO text, NO words, NO labels on images. Enforce visual shot variety and clever visual metaphor alignment with narration. "
        "Keep image prompts concise (30-50 words), natural, and free of proper-noun channel names."
    )
    
    if field_name == "script_narrative":
        return f"You are an expert scriptwriter. Generate an engaging narrative script in Khmer based on the provided context. {base_style}"
    elif field_name == "illustration_style":
        return f"You are a master illustrator director. Generate a detailed illustration style prompt based on the provided context. {base_style}"
    elif field_name == "structured_json_data":
        return f"You are a video production structurer. Output a valid JSON array of objects representing scenes. Each object must have 'scene_number' (int), 'narration_khmer' (string), 'image_prompt_english' (string), and 'negative_prompt' (string). {base_style} RETURN ONLY VALID JSON."
    elif field_name == "video_concept":
        return f"You are a creative video director. Generate a cinematic video concept direction based on the provided context. {base_style}"
    elif field_name == "global_voice_style":
        return f"You are a voiceover casting director. Generate acoustic instructions and voice styling parameters based on the provided context. {base_style}"
    else:
        return f"Generate content for {field_name} based on the context. {base_style}"
