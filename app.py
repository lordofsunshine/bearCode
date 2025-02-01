from flask import Flask, render_template, request, jsonify
from g4f.client import Client
import logging
import subprocess
from cryptography.fernet import Fernet
import tempfile
import os
import platform
import sys
from threading import Timer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
client = Client()

chat_histories = {}

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

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "No message provided"}), 400
            
        message = data['message']
        chat_id = data.get('chatId')
        
        if len(message) > MAX_MESSAGE_LENGTH:
            return jsonify({"error": "Message too long"}), 400
            
        logger.info(f"Received message: {message}")
        
        if chat_id not in chat_histories:
            chat_histories[chat_id] = []
        
        chat_histories[chat_id].append({"role": "user", "content": message})
        
        messages = chat_histories[chat_id][-5:] # 5 messages
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            web_search=False,
            stream=False
        )
        
        response_text = response.choices[0].message.content
        
        chat_histories[chat_id].append({"role": "assistant", "content": response_text})
        
        logger.info(f"API response: {response_text[:100]}...")
        
        return jsonify({"response": response_text})
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/generate-title', methods=['POST'])
def generate_title():
    try:
        message = request.json['message']
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Create a short title (4-5 words max) for the chat based on the user's first message."},
                {"role": "user", "content": message}
            ],
            web_search=False,
            stream=False
        )
        
        title = response.choices[0].message.content
        return jsonify({"title": title})
    except Exception as e:
        logger.error(f"Error generating title: {str(e)}")
        return jsonify({"title": "New Chat"})

@app.route('/execute-code', methods=['POST'])
def execute_code():
    try:
        data = request.get_json()
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

if __name__ == '__main__':
    try:
        app.run(debug=True, host='127.0.0.1', port=5000, threaded=True)
    except Exception as e:
        logger.error(f"Server startup error: {str(e)}")

