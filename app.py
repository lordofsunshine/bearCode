from g4f.client import Client
import logging
import subprocess
from cryptography.fernet import Fernet
import tempfile
import os
import platform
import sys
from threading import Timer
import uuid
from datetime import datetime
import json
from quart import Quart, render_template, request, jsonify, send_from_directory, abort
from quart_cors import cors
import asyncio
import re
import hypercorn.asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)
app = cors(app)
client = Client()

shared_chats = {}
chat_storage = {
    'messages': {},  # Chat messages
    'metadata': {}   # Chat metadata (creation time, access, etc.)
}

MAX_MESSAGE_LENGTH = 4000
EXECUTION_TIMEOUT = 10.0
SUPPORTED_LANGUAGES = {
    'python': {
        'command': [sys.executable, '-X', 'utf8'],
        'file_ext': '.py',
        'banned_imports': ['os.system', 'subprocess', 'socket']
    },
    'javascript': {
        'command': ['node'],
        'file_ext': '.js',
        'banned_imports': ['child_process', 'fs']
    }
}

ERROR_MESSAGES = {
    400: {
        'title': 'Bad Request',
        'message': 'The server could not understand your request. Please check your input and try again.'
    },
    401: {
        'title': 'Unauthorized',
        'message': 'You need to be authenticated to access this resource.'
    },
    403: {
        'title': 'Forbidden',
        'message': 'You don\'t have permission to access this resource.'
    },
    404: {
        'title': 'Not Found',
        'message': 'The resource you\'re looking for doesn\'t exist or has been moved.'
    },
    405: {
        'title': 'Method Not Allowed',
        'message': 'The method you\'re trying to use is not allowed for this resource. Please check the API documentation.'
    },
    408: {
        'title': 'Request Timeout',
        'message': 'The server timed out waiting for the request. Please try again.'
    },
    413: {
        'title': 'Payload Too Large',
        'message': 'The file or data you\'re trying to upload is too large. Please reduce the size and try again.'
    },
    415: {
        'title': 'Unsupported Media Type',
        'message': 'The format of the data you\'re trying to send is not supported.'
    },
    429: {
        'title': 'Too Many Requests',
        'message': 'You\'ve made too many requests. Please wait a while before trying again.'
    },
    500: {
        'title': 'Internal Server Error',
        'message': 'Something went wrong on our end. Please try again later.'
    },
    502: {
        'title': 'Bad Gateway',
        'message': 'The server received an invalid response from the upstream server. Please try again later.'
    },
    503: {
        'title': 'Service Unavailable',
        'message': 'The service is temporarily unavailable. Please try again later.'
    },
    504: {
        'title': 'Gateway Timeout',
        'message': 'The server timed out waiting for a response from the upstream server. Please try again later.'
    }
}

class ExecutionError(Exception):
    pass

def validate_code(code: str, language: str) -> None:
    if not code or not language:
        raise ValueError("Code and language must not be empty")
    
    if len(code) > MAX_MESSAGE_LENGTH:
        raise ValueError(f"Code length exceeds maximum limit of {MAX_MESSAGE_LENGTH} characters")
    
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")
    
    for banned in SUPPORTED_LANGUAGES[language]['banned_imports']:
        if banned in code:
            raise ValueError(f"Usage of '{banned}' is not allowed for security reasons")

def create_safe_execution_environment():
    env = os.environ.copy()
    env.update({
        'PYTHONIOENCODING': 'utf-8',
        'PYTHONUTF8': '1',
        'PYTHONPATH': '', 
        'PATH': os.path.dirname(sys.executable) 
    })
    return env

CHATS_DIR = 'chat_storage'
if not os.path.exists(CHATS_DIR):
    os.makedirs(CHATS_DIR)

def save_chat(chat_id, messages, metadata=None):
    chat_data = {
        'messages': messages,
        'metadata': metadata or {
            'created_at': datetime.now().isoformat(),
            'title': 'New Chat'
        }
    }
    
    file_path = os.path.join(CHATS_DIR, f'{chat_id}.json')
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(chat_data, f, ensure_ascii=False, indent=2)

def load_chat(chat_id):
    try:
        file_path = os.path.join(CHATS_DIR, f'{chat_id}.json')
        if not os.path.exists(file_path):
            return None
            
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading chat {chat_id}: {e}")
        return None

@app.route('/')
async def home():
    return await render_template('index.html')

@app.route('/chat', methods=['POST'])
async def chat():
    data = await request.get_json()
    message = data.get('message')
    chat_id = data.get('chatId')
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": message}]
        )
        
        if chat_id:
            chat_data = load_chat(chat_id) or {'messages': [], 'metadata': {'created_at': datetime.now().isoformat()}}
            chat_data['messages'].append({"role": "user", "content": message})
            chat_data['messages'].append({"role": "assistant", "content": response.choices[0].message.content})
            save_chat(chat_id, chat_data['messages'], chat_data['metadata'])

        return jsonify({'response': response.choices[0].message.content})
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate-title', methods=['POST'])
async def generate_title():
    data = await request.get_json()
    message = data.get('message')
    chat_id = data.get('chatId')
    
    if not message or not chat_id:
        return jsonify({'error': 'Message and chat ID required'}), 400
        
    try:
        title_prompt = f"Generate a short, concise title (max 6 words) for a chat that starts with this message: {message}"
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": title_prompt}]
        )
        title = response.choices[0].message.content.strip('" ')
        
        chat_data = load_chat(chat_id)
        if chat_data:
            chat_data['metadata']['title'] = title
            save_chat(chat_id, chat_data['messages'], chat_data['metadata'])
            
        return jsonify({'title': title})
    except Exception as e:
        logger.error(f"Error generating title: {e}")
        return jsonify({'error': str(e)}), 500

def filter_unwanted_content(text: str) -> str:
    unwanted_patterns = [
        r'You can get UNLIMITED API Key with just 10 invites! Join https:\/\/discord\.gg\/\w+',
        r'https:\/\/discord\.gg\/\w+',
        r'discord\.gg\/\w+',
        r'\/\/discord\.gg\/\w+',
        r'o1, gpt-4o, claude-3\.5-sonnet,[^]*(available for FREE)?[^]*discord\.gg\/\w+',
        r'now available for FREE'
    ]
    
    filtered_text = text
    for pattern in unwanted_patterns:
        filtered_text = re.sub(pattern, '', filtered_text, flags=re.IGNORECASE)
    
    return filtered_text.strip()

@app.route('/execute-code', methods=['POST'])
async def execute_code():
    try:
        data = await request.get_json()
        if not data or 'code' not in data or 'language' not in data:
            return jsonify({'status': 'error', 'output': 'Missing code or language'}), 400

        code = data['code']
        language = data['language'].lower()

        try:
            validate_code(code, language)
        except ValueError as e:
            return jsonify({'status': 'error', 'output': str(e)}), 400

        modified_code = code
        if language == 'python' and 'input(' in code:
            modified_code = """
def mock_input(prompt=''):
    print(prompt, end='')
    return '1'
input = mock_input
""" + "\n" + code

        with tempfile.NamedTemporaryFile(
            suffix=SUPPORTED_LANGUAGES[language]['file_ext'],
            mode='w',
            encoding='utf-8',
            delete=False
        ) as f:
            f.write(modified_code)
            temp_file = f.name

        try:
            env = create_safe_execution_environment()
            process = create_process(temp_file, language, env)
            result = run_with_timeout(process)
            
            return jsonify({
                'status': 'success',
                'output': result,
                'language': language
            })

        except ExecutionError as e:
            return jsonify({
                'status': 'error',
                'output': str(e),
                'language': language
            })
        finally:
            try:
                os.unlink(temp_file)
            except:
                pass

    except Exception as e:
        logger.error(f"Execution error: {str(e)}")
        return jsonify({
            'status': 'error',
            'output': "Internal server error",
            'language': language
        }), 500

def create_process(temp_file: str, language: str, env: dict) -> subprocess.Popen:
    command = SUPPORTED_LANGUAGES[language]['command'] + [temp_file]
    
    kwargs = {
        'stdout': subprocess.PIPE,
        'stderr': subprocess.PIPE,
        'stdin': subprocess.PIPE,
        'text': True,
        'encoding': 'utf-8',
        'env': env
    }

    if platform.system() == 'Windows':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        kwargs['startupinfo'] = startupinfo

    return subprocess.Popen(command, **kwargs)

def run_with_timeout(process: subprocess.Popen) -> str:
    def kill_process():
        try:
            process.kill()
        except:
            pass

    timer = Timer(EXECUTION_TIMEOUT, kill_process)
    try:
        timer.start()
        stdout, stderr = process.communicate(input='')
        timer.cancel()

        if process.returncode != 0:
            raise ExecutionError(stderr or "Execution failed")
            
        return stdout
    except:
        kill_process()
        raise ExecutionError("Execution timed out")

@app.route('/health-check')
async def health_check():
    return jsonify({'status': 'ok'})

@app.route('/share-chat', methods=['POST'])
async def share_chat():
    data = await request.get_json()
    chat_id = data.get('chatId')
    
    if not chat_id:
        return jsonify({'error': 'No chat ID provided'}), 400
        
    chat_data = load_chat(chat_id)
    if not chat_data:
        return jsonify({'error': 'Chat not found'}), 404
        
    share_url = f"{request.host_url}shared/{chat_id}"
    return jsonify({'share_url': share_url})

@app.route('/shared/<chat_id>')
async def view_shared_chat(chat_id):
    chat_data = load_chat(chat_id)
    if not chat_data:
        return await render_template('error.html',
            error_code=404,
            error_title='Chat Not Found',
            error_message='The chat you\'re looking for doesn\'t exist or has been deleted.'
        ), 404
        
    return await render_template('shared_chat.html', chat=chat_data)

@app.route('/files/<path:filename>')
async def serve_file(filename):
    try:
        return await send_from_directory('static', filename)
    except FileNotFoundError:
        abort(404)

@app.route('/api/shared-chat/<chat_id>')
async def get_shared_chat(chat_id):
    if chat_id not in shared_chats:
        abort(404)
    
    return jsonify(shared_chats[chat_id])

@app.template_filter('format_date')
def format_date(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    return value.strftime("%B %d, %Y at %H:%M")

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(405)
@app.errorhandler(408)
@app.errorhandler(413)
@app.errorhandler(415)
@app.errorhandler(429)
@app.errorhandler(500)
@app.errorhandler(502)
@app.errorhandler(503)
@app.errorhandler(504)
async def handle_error(error):
    error_code = error.code if hasattr(error, 'code') else 500
    error_data = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES[500])
    
    return await render_template(
        'error.html',
        error_code=error_code,
        error_title=error_data['title'],
        error_message=error_data['message']
    ), error_code

if __name__ == '__main__':
    try:
        config = hypercorn.Config()
        config.bind = ["127.0.0.1:5000"]
        config.use_reloader = True
        
        asyncio.run(hypercorn.asyncio.serve(app, config))
    except Exception as e:
        logger.error(f"Server startup error: {str(e)}")

