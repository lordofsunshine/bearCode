# bearCode AI Assistant

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Quart](https://img.shields.io/badge/Framework-Quart-yellow.svg)](https://quart.palletsprojects.com/)
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_SERVER_ID?color=%237289DA&label=Discord&logo=discord&logoColor=white)](https://discord.gg/FtvCbrc7ZU)

A modern AI-powered coding assistant with chat and image generation capabilities.

## Major Update
- https://github.com/lordofsunshine/bearCode

1. The site has been deployed to the domain **https://bearcode.lol** with improved hosting infrastructure.
2. AI response quality has been significantly enhanced with better prompt engineering and bug fixes. Full markdown support added.
3. Enhanced privacy: Our server only stores individual chat histories identified by unique session IDs (based on client info). You can clear your history anytime. All UI preferences and settings are stored locally in your browser.
4. Image generation capability with the Flux model. Access via Settings → AI Model → Flux. All preferences automatically save to localStorage.
5. Complete UI redesign with light, dark and system theme support.

## Features

- 💬 AI coding assistant powered by GPT models
- 🖼️ AI image generation with Flux model
- 🌓 Light/dark theme support
- 🚀 Fast and responsive web interface

## Screenshot

<img src="https://i.ibb.co/HT4N8ZLH/image.png" alt="bearCode AI Assistant Interface" width="800"/>

## Quick Start

```bash
# Clone repository
git clone https://github.com/lordofsunshine/bearCode
cd bearCode

# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

The server will start at http://127.0.0.1:8000

## Technology Stack

- **Backend**: Python, Quart, Hypercorn
- **AI Services**: G4F (GPT-4o-mini and Flux)
- **Frontend**: HTML, CSS, JavaScript

## Community

Join our [Discord community](https://discord.gg/FtvCbrc7ZU) for support, feature requests, and discussions! 