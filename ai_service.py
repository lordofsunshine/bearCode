import os
import logging
from typing import List, Dict, Any
from datetime import datetime
import asyncio
import base64

from g4f.client import Client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("ai_service")

client = Client()

async def generate_ai_response(user_message: str, conversation_history: List[Dict[str, Any]] = None, model: str = "gpt-4o-mini") -> str:
    try:
        messages = []
        
        messages.append({
            "role": "system", 
            "content": "You are bearCode, an AI coding assistant that helps users with programming questions. " +
                      "Be concise, helpful, and provide code examples when appropriate. " +
                      "When writing mathematical expressions, use simple, readable notation instead of complex symbols: " +
                      "- Use standard arithmetic operators: +, -, *, /, ^ for powers " +
                      "- Write fractions as numerator/denominator (e.g., 3/4 instead of \\frac{3}{4}) " +
                      "- Write square roots as sqrt(x) instead of \\sqrt{x} " +
                      "- Use simple parentheses () for grouping " +
                      "- Avoid LaTeX syntax and complex mathematical symbols that may render poorly " +
                      "- For probability expressions, use P(event) notation instead of complex symbols " +
                      "- When explaining steps, use plain language and standard notation that's easy to read"
        })
        
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        messages.append({"role": "user", "content": user_message})
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model=model,
                messages=messages,
                web_search=False
            )
        )
        
        ai_response = response.choices[0].message.content
        
        logger.info(f"Generated AI response using {model} for message: {user_message[:30]}...")
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating AI response with {model}: {str(e)}")
        return f"I'm sorry, I encountered an error while processing your request. Technical details: {str(e)}"

async def detect_programming_language(code: str) -> str:
    try:
        messages = [
            {"role": "system", "content": "You are an expert code analyzer. Respond with only the programming language name, nothing else."},
            {"role": "user", "content": f"What programming language is this?\n\n```\n{code}\n```\nRespond with only the language name, nothing else."}
        ]
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                web_search=False
            )
        )
        
        language = response.choices[0].message.content.strip().lower()
        return language
        
    except Exception as e:
        logger.error(f"Error detecting programming language: {str(e)}")
        return "unknown"

async def analyze_image(image_path: str, prompt: str = "Analyze this image") -> str:
    try:
        with open(image_path, "rb") as img_file:
            image_data = img_file.read()
        
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        file_ext = os.path.splitext(image_path)[1].lower()
        mime_type = "image/jpeg"
        if file_ext == ".png":
            mime_type = "image/png"
        elif file_ext == ".gif":
            mime_type = "image/gif"
        elif file_ext == ".webp":
            mime_type = "image/webp"
        
        messages = [
            {
                "role": "system", 
                "content": "You are bearCode, an AI assistant that can analyze images. Provide detailed, helpful, and accurate descriptions of image content. " +
                          "When writing mathematical expressions, use simple, readable notation instead of complex symbols: " +
                          "- Use standard arithmetic operators: +, -, *, /, ^ for powers " +
                          "- Write fractions as numerator/denominator (e.g., 3/4 instead of \\frac{3}{4}) " +
                          "- Write square roots as sqrt(x) instead of \\sqrt{x} " +
                          "- Use simple parentheses () for grouping " +
                          "- Avoid LaTeX syntax and complex mathematical symbols that may render poorly " +
                          "- For probability expressions, use P(event) notation instead of complex symbols " +
                          "- When explaining steps, use plain language and standard notation that's easy to read"
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ]
        
        logger.info(f"Sending image for analysis with prompt: {prompt[:30]}...")
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                web_search=False
            )
        )
        
        analysis = response.choices[0].message.content
        logger.info(f"Generated image analysis")
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        return f"I encountered an error while analyzing the image. Technical details: {str(e)}"

async def analyze_image_base64(base64_image_url: str, prompt: str = "Analyze this image") -> str:
    try:
        logger.info(f"Analyzing image from base64 data with prompt: {prompt[:30]}...")
        
        messages = [
            {
                "role": "system", 
                "content": "You are bearCode, an AI assistant that can analyze images. Provide detailed, helpful, and accurate descriptions of image content. " +
                          "When writing mathematical expressions, use simple, readable notation instead of complex symbols: " +
                          "- Use standard arithmetic operators: +, -, *, /, ^ for powers " +
                          "- Write fractions as numerator/denominator (e.g., 3/4 instead of \\frac{3}{4}) " +
                          "- Write square roots as sqrt(x) instead of \\sqrt{x} " +
                          "- Use simple parentheses () for grouping " +
                          "- Avoid LaTeX syntax and complex mathematical symbols that may render poorly " +
                          "- For probability expressions, use P(event) notation instead of complex symbols " +
                          "- When explaining steps, use plain language and standard notation that's easy to read"
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": base64_image_url
                        }
                    }
                ]
            }
        ]
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                web_search=False
            )
        )
        
        analysis = response.choices[0].message.content
        logger.info(f"Generated image analysis")
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing base64 image: {str(e)}")
        return f"I encountered an error while analyzing the image. Technical details: {str(e)}"

if __name__ == "__main__":
    async def test():
        test_message = "How do I create a simple HTTP server in Python?"
        print(f"User: {test_message}")
        print(f"AI: {await generate_ai_response(test_message)}")
    
    asyncio.run(test())
