import os
import asyncio
from typing import Optional
from datetime import datetime

import g4f
from g4f.client import Client

client = Client()

async def generate_image_url(prompt: str, model: str = "flux") -> str:
    try:
        loop = asyncio.get_event_loop()
        
        try:
            response = await loop.run_in_executor(
                None,
                lambda: client.images.generate(
                    model=model,
                    prompt=prompt,
                    response_format="url"
                )
            )
            
            image_url = response.data[0].url
            
            return image_url
            
        except asyncio.CancelledError:
            raise
            
    except asyncio.CancelledError:
        raise
        
    except Exception as e:
        raise Exception(f"Failed to generate image: {str(e)}")

if __name__ == "__main__":
    pass