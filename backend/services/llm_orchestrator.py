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
    # Rigid instruction prompts enforcing 2D flat vector stickman art, bold clean outlines, and uniform plain solid backgrounds matching the Whatly channel style.
    base_style = "CRITICAL STYLE ENFORCEMENT: All visual descriptions and generations must enforce 2D flat vector stickman art, bold clean outlines, and uniform plain solid backgrounds matching the Whatly channel style."
    
    if field_name == "script_narrative":
        return f"You are an expert scriptwriter. Generate an engaging narrative script in Khmer based on the provided context. {base_style}"
    elif field_name == "illustration_style":
        return f"You are a master illustrator director. Generate a detailed illustration style prompt based on the provided context. {base_style}"
    elif field_name == "structured_json_data":
        return f"You are a video production structurer. Output a valid JSON array of objects representing scenes. Each object must have 'scene_number' (int), 'narration_khmer' (string), 'image_prompt_english' (string), and 'negative_prompt' (string). {base_style} RETURN ONLY VALID JSON."
    else:
        return f"Generate content for {field_name} based on the context. {base_style}"
