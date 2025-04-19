import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import asyncio

from quart import Quart, request, websocket, render_template, send_from_directory, jsonify, after_this_request
from hypercorn.config import Config
from hypercorn.asyncio import serve
from pydantic import BaseModel
from dotenv import load_dotenv
from colorama import init, Fore, Style

init(autoreset=True)

from ai_service import generate_ai_response
from image_service import generate_image_url

print(f"{Fore.GREEN}✓ {Fore.CYAN}Initializing bearCode AI Assistant...{Style.RESET_ALL}")

load_dotenv()
print(f"{Fore.GREEN}✓ {Fore.CYAN}Environment variables loaded{Style.RESET_ALL}")

app = Quart(__name__, static_folder="", static_url_path="")
print(f"{Fore.GREEN}✓ {Fore.CYAN}Quart application initialized{Style.RESET_ALL}")

class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    
chat_history: Dict[str, List[Message]] = {
    "default": [
        Message(
            role="assistant",
            content="Hello! I'm bearCode, your AI coding assistant. How can I help you today?",
            timestamp=datetime.now()
        )
    ]
}

print(f"{Fore.GREEN}✓ {Fore.CYAN}Chat history initialized{Style.RESET_ALL}")

@app.route("/")
async def index():
    return await send_from_directory("", "templates/index.html")

@app.route("/privacy-policy")
async def privacy_policy():
    return await send_from_directory("", "templates/privacy-policy.html")

@app.route("/api/chat", methods=["POST"])
async def chat():
    try:
        data = await request.get_json()
        chat_id = data.get("chat_id", "default")
        user_message = data.get("message", "")
        model = data.get("model", "gpt-4o-mini")
        
        if not user_message:
            return jsonify({"error": "Message cannot be empty"}), 400
        
        if chat_id not in chat_history:
            chat_history[chat_id] = []
        
        chat_history[chat_id].append(
            Message(
                role="user",
                content=user_message,
                timestamp=datetime.now()
            )
        )
        
        history_for_ai = []
        for msg in chat_history[chat_id]:
            history_for_ai.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            response = await generate_ai_response(user_message, history_for_ai, model=model)
            
            chat_history[chat_id].append(
                Message(
                    role="assistant",
                    content=response,
                    timestamp=datetime.now()
                )
            )
            
            return jsonify({
                "response": response,
                "timestamp": datetime.now().isoformat()
            })
        except asyncio.CancelledError:
            print(f"{Fore.YELLOW}ℹ Request cancelled by client{Style.RESET_ALL}")
            return jsonify({"error": "Request was cancelled"}), 499
    
    except Exception as e:
        print(f"{Fore.RED}✗ Error in chat endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
async def get_history():
    chat_id = request.args.get("chat_id", "default")
    
    if chat_id not in chat_history:
        return jsonify({"error": "Chat history not found"}), 404
    
    history = [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
        }
        for msg in chat_history[chat_id]
    ]
    
    return jsonify({"history": history})

@app.route("/api/clear", methods=["POST"])
async def clear_chat():
    try:
        data = await request.get_json()
        chat_id = data.get("chat_id", "default")
        
        chat_history[chat_id] = [
            Message(
                role="assistant",
                content="Hello! I'm bearCode, your AI coding assistant. How can I help you today?",
                timestamp=datetime.now()
            )
        ]
        
        return jsonify({"status": "success"})
    
    except Exception as e:
        print(f"{Fore.RED}✗ Error in clear_chat endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/new", methods=["POST"])
async def new_chat():
    try:
        new_chat_id = f"chat_{datetime.now().timestamp()}"
        
        chat_history[new_chat_id] = [
            Message(
                role="assistant",
                content="Hello! I'm bearCode, your AI coding assistant. How can I help you today?",
                timestamp=datetime.now()
            )
        ]
        
        return jsonify({
            "status": "success",
            "chat_id": new_chat_id
        })
    
    except Exception as e:
        print(f"{Fore.RED}✗ Error in new_chat endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate-image", methods=["POST"])
async def generate_image():
    task = None
    try:
        data = await request.get_json()
        chat_id = data.get("chat_id", "default")
        prompt = data.get("prompt", "")
        
        if not prompt:
            return jsonify({"error": "Prompt cannot be empty"}), 400
        
        if chat_id not in chat_history:
            chat_history[chat_id] = []
        
        chat_history[chat_id].append(
            Message(
                role="user",
                content=prompt,
                timestamp=datetime.now()
            )
        )
        
        task = asyncio.create_task(generate_image_url(prompt))
        
        @after_this_request
        def on_request_end(response):
            if task and not task.done():
                task.cancel()
                print(f"{Fore.YELLOW}ℹ Client disconnected, cancelled image generation task{Style.RESET_ALL}")
            return response
        
        try:
            print(f"{Fore.CYAN}ℹ Generating image from prompt: '{prompt[:50]}...'{Style.RESET_ALL}")
            image_url = await task
            
            response_content = f"I've generated an image based on your prompt: \"{prompt}\""
            
            chat_history[chat_id].append(
                Message(
                    role="assistant",
                    content=response_content,
                    timestamp=datetime.now()
                )
            )
            
            return jsonify({
                "url": image_url,
                "timestamp": datetime.now().isoformat()
            })
        except asyncio.CancelledError:
            print(f"{Fore.YELLOW}ℹ Image generation was cancelled by client{Style.RESET_ALL}")
            
            return jsonify({"error": "Image generation cancelled"}), 499
            
        except Exception as e:
            error_message = f"Failed to generate image: {str(e)}"
            print(f"{Fore.RED}✗ {error_message}{Style.RESET_ALL}")
            
            chat_history[chat_id].append(
                Message(
                    role="assistant",
                    content=f"I'm sorry, I couldn't generate that image. Error: {str(e)}",
                    timestamp=datetime.now()
                )
            )
            
            return jsonify({"error": error_message}), 500
    
    except Exception as e:
        if task and not task.done():
            task.cancel()
            
        print(f"{Fore.RED}✗ Error in generate_image endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
async def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
async def server_error(error):
    return jsonify({"error": "Server error"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    
    config = Config()
    config.bind = [f"127.0.0.1:{port}"]
    
    if os.environ.get("ENVIRONMENT") != "production":
        config.use_reloader = True
        config.debug = True
    
    environment = os.environ.get("ENVIRONMENT", "development")
    print(f"{Fore.GREEN}✓ {Fore.CYAN}Configuration loaded - Environment: {Fore.YELLOW}{environment}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}✓ {Fore.CYAN}AI services initialized{Style.RESET_ALL}")
    print(f"\n{Fore.GREEN}{'='*50}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}  bearCode AI Assistant is ready to use!{Style.RESET_ALL}")
    print(f"{Fore.CYAN}  Server running at: {Fore.YELLOW}http://127.0.0.1:{port}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*50}{Style.RESET_ALL}\n")
    
    asyncio.run(serve(app, config))