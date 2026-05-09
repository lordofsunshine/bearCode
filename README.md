# bearCode AI Chat

A modern Quart web chat with a server-side AI endpoint. The API key stays in `.env`; the frontend never receives it.

## Features

- Clean chat UI with saved message history
- Three most recent chats per user session
- AI-generated short chat titles
- Typing indicator and animated assistant responses
- Safer handling for jailbreak and harmful requests
- Responsive SaaS-style layout for desktop and mobile

## Setup

Создайте `.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://127.0.0.1:8080
OPENROUTER_SITE_NAME=bearCode AI Chat
```

To use a specific free model, set it with the `:free` suffix, for example:

```env
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
```

## Run

```bash
pip install -r requirements.txt
python app.py
```

The app will be available at http://127.0.0.1:8080.

## Stack

- Backend: Python, Quart, Hypercorn, aiohttp
- AI: Server-side chat completions
- Frontend: HTML, CSS, JavaScript
