import os
import logging
from typing import List, Dict, Any
from datetime import datetime
import asyncio

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
                      "Be concise, helpful, and provide code examples when appropriate."
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

if __name__ == "__main__":
    async def test():
        test_message = "How do I create a simple HTTP server in Python?"
        print(f"User: {test_message}")
        print(f"AI: {await generate_ai_response(test_message)}")
    
    asyncio.run(test())