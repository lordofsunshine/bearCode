import os
import json
import base64
import secrets
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiofiles
from quart import Quart, request, websocket, render_template, send_from_directory, jsonify, after_this_request
from hypercorn.config import Config
from hypercorn.asyncio import serve
from pydantic import BaseModel
from dotenv import load_dotenv
from colorama import init, Fore, Style

from ai_service import generate_ai_response, analyze_image, analyze_image_base64
from image_service import generate_image_url

init(autoreset=True)

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
    
chat_history: Dict[str, Dict[str, List[Message]]] = {}

print(f"{Fore.GREEN}✓ {Fore.CYAN}Chat history initialized{Style.RESET_ALL}")

def get_user_identifier():
    session_id = request.headers.get('X-User-Session-ID')
    if session_id:
        return session_id
    
    return request.remote_addr or "unknown"

def get_default_message():
    return Message(
        role="assistant",
        content="Hello! I'm bearCode, your AI coding assistant. How can I help you today?",
        timestamp=datetime.now()
    )

def ensure_user_chat_exists(user_id, chat_id="default"):
    if user_id not in chat_history:
        chat_history[user_id] = {}
    
    if chat_id not in chat_history[user_id]:
        chat_history[user_id][chat_id] = [get_default_message()]
    
    return chat_history[user_id][chat_id]

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
        
        user_id = get_user_identifier()
        user_chat = ensure_user_chat_exists(user_id, chat_id)
        
        user_chat.append(
            Message(
                role="user",
                content=user_message,
                timestamp=datetime.now()
            )
        )
        
        history_for_ai = []
        for msg in user_chat:
            history_for_ai.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            response = await generate_ai_response(user_message, history_for_ai, model=model)
            
            user_chat.append(
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
    user_id = get_user_identifier()
    
    if user_id not in chat_history or chat_id not in chat_history[user_id]:
        ensure_user_chat_exists(user_id, chat_id)
    
    user_chat = chat_history[user_id][chat_id]
    
    history = [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
        }
        for msg in user_chat
    ]
    
    return jsonify({"history": history})

@app.route("/api/clear", methods=["POST"])
async def clear_chat():
    try:
        data = await request.get_json()
        chat_id = data.get("chat_id", "default")
        user_id = get_user_identifier()
        
        if user_id in chat_history and chat_id in chat_history[user_id]:
            chat_history[user_id][chat_id] = [get_default_message()]
        else:
            ensure_user_chat_exists(user_id, chat_id)
        
        return jsonify({"status": "success"})
    
    except Exception as e:
        print(f"{Fore.RED}✗ Error in clear_chat endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/new", methods=["POST"])
async def new_chat():
    try:
        new_chat_id = f"chat_{datetime.now().timestamp()}"
        user_id = get_user_identifier()
        
        ensure_user_chat_exists(user_id, new_chat_id)
        
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
        
        user_id = get_user_identifier()
        user_chat = ensure_user_chat_exists(user_id, chat_id)
        
        user_chat.append(
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
            
            user_chat.append(
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
            
            user_chat.append(
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

@app.route("/api/analyze-image", methods=["POST"])
async def analyze_uploaded_image():
    task = None
    try:
        data = await request.get_json()
        image_data = data.get('image')
        chat_id = data.get('chat_id', 'default')
        message = data.get('message', 'Analyze this image')
        
        if not image_data or not image_data.startswith('data:image/'):
            return jsonify({"error": "No valid image data provided"}), 400
        
        user_id = get_user_identifier()
        user_chat = ensure_user_chat_exists(user_id, chat_id)
        
        user_chat.append(
            Message(
                role="user",
                content=f"{message}\n\n[Image attached]",
                timestamp=datetime.now()
            )
        )
        
        task = asyncio.create_task(analyze_image_base64(image_data, message))
        
        @after_this_request
        def on_request_end(response):
            if task and not task.done():
                task.cancel()
                print(f"{Fore.YELLOW}ℹ Client disconnected, cancelled image analysis task{Style.RESET_ALL}")
            return response
        
        try:
            print(f"{Fore.CYAN}ℹ Analyzing image from base64 data{Style.RESET_ALL}")
            analysis = await task
            
            user_chat.append(
                Message(
                    role="assistant",
                    content=analysis,
                    timestamp=datetime.now()
                )
            )
            
            return jsonify({
                "response": analysis,
                "timestamp": datetime.now().isoformat()
            })
            
        except asyncio.CancelledError:
            print(f"{Fore.YELLOW}ℹ Image analysis was cancelled by client{Style.RESET_ALL}")
            return jsonify({"error": "Image analysis cancelled"}), 499
            
        except Exception as e:
            error_message = f"Failed to analyze image: {str(e)}"
            print(f"{Fore.RED}✗ {error_message}{Style.RESET_ALL}")
            
            user_chat.append(
                Message(
                    role="assistant",
                    content=f"I'm sorry, I couldn't analyze that image. Error: {str(e)}",
                    timestamp=datetime.now()
                )
            )
            
            return jsonify({"error": error_message}), 500
    
    except Exception as e:
        print(f"{Fore.RED}✗ Error in analyze_image endpoint: {str(e)}{Style.RESET_ALL}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(400)
async def bad_request(error):
    return jsonify({
        "error": "Bad Request",
        "message": "The server could not understand your request. Please check your input and try again.",
        "status_code": 400
    }), 400

@app.errorhandler(401)
async def unauthorized(error):
    return jsonify({
        "error": "Unauthorized",
        "message": "Authentication is required to access this resource.",
        "status_code": 401
    }), 401

@app.errorhandler(403)
async def forbidden(error):
    return jsonify({
        "error": "Forbidden",
        "message": "You don't have permission to access this resource.",
        "status_code": 403
    }), 403

@app.errorhandler(404)
async def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource could not be found on the server.",
        "status_code": 404
    }), 404

@app.errorhandler(405)
async def method_not_allowed(error):
    return jsonify({
        "error": "Method Not Allowed",
        "message": "The method specified in the request is not allowed for the resource.",
        "status_code": 405
    }), 405

@app.errorhandler(408)
async def request_timeout(error):
    return jsonify({
        "error": "Request Timeout",
        "message": "The server timed out waiting for the request.",
        "status_code": 408
    }), 408

@app.errorhandler(429)
async def too_many_requests(error):
    return jsonify({
        "error": "Too Many Requests",
        "message": "You have sent too many requests in a given amount of time.",
        "status_code": 429
    }), 429

@app.errorhandler(500)
async def server_error(error):
    return jsonify({
        "error": "Server Error",
        "message": "The server encountered an unexpected condition that prevented it from fulfilling the request.",
        "status_code": 500
    }), 500

@app.errorhandler(503)
async def service_unavailable(error):
    return jsonify({
        "error": "Service Unavailable",
        "message": "The server is currently unavailable or overloaded. Please try again later.",
        "status_code": 503
    }), 503

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    
    config = Config()
    config.bind = [f"127.0.0.1:{port}"]
    
    if os.environ.get("ENVIRONMENT") != "production":
        config.use_reloader = True
    
    environment = os.environ.get("ENVIRONMENT", "development")
    print(f"{Fore.GREEN}✓ {Fore.CYAN}Configuration loaded - Environment: {Fore.YELLOW}{environment}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}✓ {Fore.CYAN}AI services initialized{Style.RESET_ALL}")
    print(f"\n{Fore.GREEN}{'='*50}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}  bearCode AI Assistant is ready to use!{Style.RESET_ALL}")
    print(f"{Fore.CYAN}  Server running at: {Fore.YELLOW}http://127.0.0.1:{port}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}{'='*50}{Style.RESET_ALL}\n")
    
    asyncio.run(serve(app, config))