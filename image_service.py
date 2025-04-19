import os
import logging
import asyncio
from typing import Optional
from datetime import datetime

import g4f
from g4f.client import Client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("image_service")

client = Client()

async def generate_image_url(prompt: str, model: str = "flux") -> str:
    try:
        logger.info(f"Generating image with prompt: {prompt[:50]}...")
        
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
            
            logger.info(f"Successfully generated image: {image_url[:50]}...")
            return image_url
            
        except asyncio.CancelledError:
            logger.warning(f"Image generation cancelled for prompt: {prompt[:50]}")
            raise
            
    except asyncio.CancelledError:
        logger.warning(f"Image generation cancelled for prompt: {prompt[:50]}")
        raise
        
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise Exception(f"Failed to generate image: {str(e)}")

if __name__ == "__main__":
    async def test():
        try:
            prompt = "A cute cat playing with a ball of yarn"
            print(f"Prompt: {prompt}")
            image_url = await generate_image_url(prompt)
            print(f"Generated image URL: {image_url}")
        except asyncio.CancelledError:
            print("Image generation was cancelled")
        except Exception as e:
            print(f"Error: {str(e)}")
    
    asyncio.run(test())