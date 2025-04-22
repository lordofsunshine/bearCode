import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import base64

from g4f.client import Client

from web_scraper import extract_urls_from_text, analyze_urls_in_text

client = Client()

PROMPT_TEMPLATES = {
    "key_information": {
        "name": "Key Information Extraction",
        "description": "Extract the most important information from the text or URLs",
        "system_prompt": "You are bearCode, an AI assistant specialized in extracting key information. " +
                        "Focus on identifying and summarizing the most important facts, statistics, " +
                        "claims, and conclusions from the content. Organize the information by relevance " +
                        "and present it in a clear, structured format with categories and bullet points when appropriate.",
        "user_prefix": "Extract and summarize the key information from the following: "
    },
    "contact_extraction": {
        "name": "Contact Information Extraction",
        "description": "Extract contact details like emails, phone numbers, addresses, etc.",
        "system_prompt": "You are bearCode, an AI assistant specialized in extracting contact information. " +
                        "Your task is to identify and extract all contact details including emails, phone numbers, " +
                        "physical addresses, usernames, social media profiles, and any other relevant contact methods. " +
                        "Present the information in a structured format, organized by type of contact information.",
        "user_prefix": "Extract all contact information from the following: "
    },
    "code_analysis": {
        "name": "Code Analysis",
        "description": "Analyze code structure, identify issues, and suggest improvements",
        "system_prompt": "You are bearCode, an AI coding assistant specialized in code analysis. " +
                        "Examine the provided code for structure, patterns, potential bugs, security vulnerabilities, " +
                        "performance issues, and adherence to best practices. Provide constructive feedback and " +
                        "specific suggestions for improvement with code examples when appropriate.",
        "user_prefix": "Analyze the following code and provide feedback: "
    },
    "technical_explanation": {
        "name": "Technical Explanation",
        "description": "Explain technical concepts in a clear, detailed manner",
        "system_prompt": "You are bearCode, an AI assistant specialized in explaining technical concepts. " +
                        "Break down complex technical topics into understandable explanations with appropriate " +
                        "depth based on the apparent expertise level of the user. Use analogies, examples, " +
                        "and visual descriptions when helpful. Maintain accuracy while making the information accessible.",
        "user_prefix": "Explain the following technical concept in detail: "
    },
    "data_analysis": {
        "name": "Data Analysis",
        "description": "Analyze patterns, trends, and insights from data",
        "system_prompt": "You are bearCode, an AI assistant specialized in data analysis. " +
                        "Identify patterns, trends, correlations, anomalies, and key insights from the provided data. " +
                        "Present findings in a structured format with statistical observations when relevant. " +
                        "Suggest potential interpretations and follow-up analyses that might be valuable.",
        "user_prefix": "Analyze the following data and provide insights: "
    }
}

async def get_prompt_templates() -> Dict[str, Dict[str, str]]:
    templates_meta = {}
    for template_id, template in PROMPT_TEMPLATES.items():
        templates_meta[template_id] = {
            "name": template["name"],
            "description": template["description"]
        }
    return templates_meta

async def generate_ai_response(
    user_message: str, 
    conversation_history: List[Dict[str, Any]] = None, 
    model: str = "gpt-4o-mini",
    template_id: Optional[str] = None
) -> str:
    try:
        messages = []
        
        system_message = "You are bearCode, an AI coding assistant that helps users with programming questions. " +\
                      "Be concise, helpful, and provide code examples when appropriate. " +\
                      "When writing mathematical expressions, use simple, readable notation instead of complex symbols: " +\
                      "- Use standard arithmetic operators: +, -, *, /, ^ for powers " +\
                      "- Write fractions as numerator/denominator (e.g., 3/4 instead of \\frac{3}{4}) " +\
                      "- Write square roots as sqrt(x) instead of \\sqrt{x} " +\
                      "- Use simple parentheses () for grouping " +\
                      "- Avoid LaTeX syntax and complex mathematical symbols that may render poorly " +\
                      "- For probability expressions, use P(event) notation instead of complex symbols " +\
                      "- When explaining steps, use plain language and standard notation that's easy to read"
        
        if template_id and template_id in PROMPT_TEMPLATES:
            template = PROMPT_TEMPLATES[template_id]
            system_message = template["system_prompt"]
            
            prefix = template["user_prefix"]
            if not user_message.startswith(prefix):
                user_message = f"{prefix}{user_message}"
            
        messages.append({
            "role": "system", 
            "content": system_message
        })
        
        url_analysis_results = await analyze_urls_in_text(user_message)
        
        if url_analysis_results["found"]:
            url_contexts = []
            for result in url_analysis_results["results"]:
                if result["success"]:
                    url_contexts.append(f"Web content from {result['url']}:\n{result['content']}")
            
            if url_contexts:
                context_message = "\n\n".join(url_contexts)
                
                messages.append({
                    "role": "system",
                    "content": "The user message contains URLs. I've analyzed these webpages and extracted their content. " +
                              "Use this information to provide a comprehensive response. Only reference the URLs if relevant " +
                              "to answering the user's question. Here is the extracted content:\n\n" + context_message
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
        
        return ai_response
        
    except Exception as e:
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
        
        return analysis
        
    except Exception as e:
        return f"I encountered an error while analyzing the image. Technical details: {str(e)}"

async def analyze_image_base64(base64_image_url: str, prompt: str = "Analyze this image") -> str:
    try:
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
        
        return analysis
        
    except Exception as e:
        return f"I encountered an error while analyzing the image. Technical details: {str(e)}"

async def process_url_content(url: str) -> str:
    try:
        from web_scraper import analyze_url
        
        content, error = await analyze_url(url)
        
        if error:
            return f"Error analyzing URL {url}: {error}"
        
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
                "content": f"Summarize the key information from this webpage:\n\n{content}"
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
        
        return f"AI ANALYSIS:\n{analysis}\n\nORIGINAL CONTENT:\n{content}"
    
    except Exception as e:
        return f"Error processing URL {url}: {str(e)}"

if __name__ == "__main__":
    pass