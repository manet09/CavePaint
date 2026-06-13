import os
import json
import google.generativeai as genai

# Configure GenAI SDK
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "DUMMY_KEY"))

def generate_initial_scenes(research: str, script: str, video_concept: str, image_style: str):
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    system_instruction = """
    You are an expert video producer.
    Given the project research, script, concept, and style, you must output a JSON array of scenes.
    Each object in the array must strictly match this schema:
    {
      "scene_number": <int>,
      "narration_khmer": <string>,
      "image_prompt_english": <string>
    }
    """
    
    prompt = f"Research: {research}\nScript: {script}\nConcept: {video_concept}\nImage Style: {image_style}\n{system_instruction}"
    
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)

def refine_image_prompt(existing_prompt: str, user_instruction: str, style: str) -> str:
    model = genai.GenerativeModel('gemini-2.5-flash')
    prompt = (f"Refine the following image generation prompt based on the user instruction and style constraints.\n"
              f"Current Prompt: {existing_prompt}\n"
              f"Style: {style}\n"
              f"User Instruction: {user_instruction}\n"
              f"Return ONLY the refined English text string.")
              
    response = model.generate_content(prompt)
    return response.text.strip()
