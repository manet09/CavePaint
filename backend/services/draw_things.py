import os
import base64
import requests

def trigger_local_render(prompt: str, project_name: str, scene_number: int, width: int = 576, height: int = 1024, cfg_scale: float = 7.5, steps: int = 30, init_image_path: str = None, negative_prompt: str = "") -> str:
    # Determine save path
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_name)
    os.makedirs(project_dir, exist_ok=True)
    
    padded_scene_number = f"{int(scene_number):02d}"
    save_path = os.path.join(project_dir, f"scene_{padded_scene_number}.png")
    
    # Send request to Draw Things API
    endpoint = "http://127.0.0.1:7860/sdapi/v1/txt2img"
    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,

    }
    
    if init_image_path and os.path.exists(init_image_path):
        try:
            with open(init_image_path, "rb") as f:
                b64_init = base64.b64encode(f.read()).decode("utf-8")
            payload["init_images"] = [b64_init]
            payload["denoising_strength"] = 0.55
            endpoint = "http://127.0.0.1:7860/sdapi/v1/img2img"
        except Exception as e:
            print(f"Failed to load init image, falling back to txt2img: {e}")
    
    try:
        response = requests.post(endpoint, json=payload, timeout=300)
        response.raise_for_status()
        data = response.json()
        
        # Decode base64 image
        if "images" in data and len(data["images"]) > 0:
            b64_image = data["images"][0]
            # Handle potential prefix
            if b64_image.startswith("data:image/png;base64,"):
                b64_image = b64_image.split(",")[1]
            
            image_data = base64.b64decode(b64_image)
            with open(save_path, "wb") as f:
                f.write(image_data)
            return save_path
        else:
            raise Exception("No image returned from Draw Things API")
            
    except requests.exceptions.ConnectionError:
        print("Draw Things API is unreachable. Generating a fallback placeholder image...")
        try:
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (width, height), color = (30, 41, 59)) # Slate background
            d = ImageDraw.Draw(img)
            
            # Simple text wrapping logic
            text = "Draw Things API Offline\n" + prompt[:50] + ("..." if len(prompt) > 50 else "")
            d.text((width//2 - 100, height//2 - 20), text, fill=(148, 163, 184))
            
            img.save(save_path)
            return save_path
        except Exception as pil_error:
            print(f"Fallback generation failed: {pil_error}")
            raise Exception("Draw Things API is unreachable and fallback image generation failed.")
            
    except Exception as e:
        print(f"Error calling Draw Things API: {e}")
        raise e