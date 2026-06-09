import os
import base64
import requests

def trigger_local_render(prompt: str, project_name: str, scene_number: int, width: int = 576, height: int = 1024, cfg_scale: float = 7.5, steps: int = 30) -> str:
    # Determine save path
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    scene_dir = os.path.join(workspace_dir, project_name, f"scene_{scene_number}")
    os.makedirs(scene_dir, exist_ok=True)
    
    save_path = os.path.join(scene_dir, "image.png")
    
    # Send request to Draw Things API
    payload = {
        "prompt": prompt,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height
    }
    
    try:
        response = requests.post("http://127.0.0.1:7860/sdapi/v1/txt2img", json=payload, timeout=300)
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
    except Exception as e:
        print(f"Error calling Draw Things API: {e}")
        raise e
