import os
from fastapi import HTTPException
from sqlalchemy.orm import Session
from backend.database import Setting
import google.generativeai as genai
from groq import Groq

def strip_markdown(text: str) -> str:
    """Removes markdown code blocks like ```json ... ``` or ``` ... ```"""
    if not text:
        return text
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove the first line containing ```
        if len(lines) > 1 and lines[0].startswith("```"):``
            lines = lines[1:]
        # Remove the last line if it is ```
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text``

def generate_text(db: Session, system_prompt: str, user_content: str, json_mode: bool = False) -> str:
    setting = db.query(Setting).first()
    
    if not setting:
        provider = "gemini"
        slot = 1
    else:
        provider = (setting.active_provider or "gemini").lower()
        slot = setting.active_slot or 1
        
    if provider == "gemini":
        key_name = f"GEMINI_KEY_{slot}"
        api_key = os.environ.get(key_name)
        if not api_key:
            raise HTTPException(
                status_code=500, 
                detail=f"Missing API Key configuration for Gemini Slot {slot}. Please check your environment configurations."
            )
            
        genai.configure(api_key=api_key)
        
        # Use gemini-1.5-pro as standard good model for production
        model = genai.GenerativeModel(
            "gemini-1.5-pro",
            system_instruction=system_prompt
        )
        
        generation_config = genai.types.GenerationConfig()
        if json_mode:
            generation_config.response_mime_type = "application/json"
            
        try:
            response = model.generate_content(
                user_content,
                generation_config=generation_config
            )
            result = response.text
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
            
    elif provider == "groq":
        key_name = f"GROQ_KEY_{slot}"
        api_key = os.environ.get(key_name)
        if not api_key:
            raise HTTPException(
                status_code=500, 
                detail=f"Missing API Key configuration for Groq Slot {slot}. Please check your environment configurations."
            )
            
        client = Groq(api_key=api_key)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        kwargs = {
            "model": "llama3-70b-8192",
            "messages": messages,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        try:
            chat_completion = client.chat.completions.create(**kwargs)
            result = chat_completion.choices[0].message.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")
            
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported provider: {provider}")

    # Enforce anti-markup constraint
    if not json_mode:
        result = strip_markdown(result)
    else:
        # Sometimes even in json_mode the model wraps in markdown, so strip it to be safe
        result = strip_markdown(result)
        
    return result
