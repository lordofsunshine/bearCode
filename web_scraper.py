import os
import re
import asyncio
import ssl
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse

import aiohttp
from bs4 import BeautifulSoup

async def extract_urls_from_text(text: str) -> List[str]:
    url_pattern = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\.-]*(?:\?[=&\w\.\-]*)*'
    return re.findall(url_pattern, text)

async def fetch_url_content(url: str, timeout: int = 30, verify_ssl: bool = False) -> Tuple[Optional[str], Optional[str]]:
    try:
        timeout_ctx = aiohttp.ClientTimeout(total=timeout)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.google.com/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        }
        
        if not verify_ssl:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            conn = aiohttp.TCPConnector(ssl=ssl_context)
            async with aiohttp.ClientSession(timeout=timeout_ctx, connector=conn) as session:
                async with session.get(url, headers=headers, allow_redirects=True) as response:
                    if response.status == 200:
                        content_type = response.headers.get('Content-Type', '').lower()
                        
                        if 'text/html' in content_type:
                            html_content = await response.text()
                            return html_content, None
                        else:
                            return None, f"URL doesn't contain HTML content (Content-Type: {content_type})"
                    else:
                        return None, f"Failed to fetch URL: HTTP {response.status}"
        else:
            async with aiohttp.ClientSession(timeout=timeout_ctx) as session:
                async with session.get(url, headers=headers, allow_redirects=True) as response:
                    if response.status == 200:
                        content_type = response.headers.get('Content-Type', '').lower()
                        
                        if 'text/html' in content_type:
                            html_content = await response.text()
                            return html_content, None
                        else:
                            return None, f"URL doesn't contain HTML content (Content-Type: {content_type})"
                    else:
                        return None, f"Failed to fetch URL: HTTP {response.status}"
    
    except aiohttp.ClientError as e:
        return None, f"Client error: {str(e)}"
    except asyncio.TimeoutError:
        return None, f"Request timed out after {timeout} seconds"
    except Exception as e:
        return None, f"Error fetching URL: {str(e)}"

async def extract_text_from_html(html_content: str, url: str) -> str:
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for script_or_style in soup(['script', 'style', 'header', 'footer', 'nav']):
            script_or_style.decompose()
            
        content_areas = soup.select('article, main, #content, .content, [role="main"]')
        
        if content_areas:
            content = content_areas[0].get_text(separator='\n', strip=True)
        else:
            content = soup.body.get_text(separator='\n', strip=True) if soup.body else soup.get_text(separator='\n', strip=True)
        
        lines = (line.strip() for line in content.splitlines())
        content = '\n'.join(line for line in lines if line)
        
        title = soup.title.string if soup.title else "No title found"
        
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and "content" in meta_tag.attrs:
            meta_desc = meta_tag["content"]
        
        domain = urlparse(url).netloc
        summary = f"URL: {url}\nDomain: {domain}\nTitle: {title}\n"
        if meta_desc:
            summary += f"Description: {meta_desc}\n"
        
        full_text = f"{summary}\n\nCONTENT:\n{content}"
        
        max_length = 15000
        if len(full_text) > max_length:
            full_text = full_text[:max_length] + "...\n[Content truncated due to length]"
        
        return full_text
    
    except Exception as e:
        return f"Error extracting text from {url}: {str(e)}"

async def analyze_url(url: str) -> Tuple[str, Optional[str]]:
    html_content, error = await fetch_url_content(url, verify_ssl=True)
    
    if error and "SSL" in error:
        html_content, error = await fetch_url_content(url, verify_ssl=False)
    
    if error:
        return "", error
    
    if html_content:
        text_content = await extract_text_from_html(html_content, url)
        return text_content, None
    
    return "", "No content extracted from URL"

async def analyze_urls_in_text(text: str) -> Dict[str, Any]:
    urls = await extract_urls_from_text(text)
    
    if not urls:
        return {"found": False, "message": "No URLs found in the text"}
    
    results = []
    for url in urls[:3]:
        content, error = await analyze_url(url)
        
        if error:
            results.append({
                "url": url,
                "success": False,
                "error": error,
                "content": ""
            })
        else:
            results.append({
                "url": url,
                "success": True,
                "error": None,
                "content": content
            })
    
    return {
        "found": True,
        "count": len(urls),
        "analyzed": len(results),
        "results": results
    }

if __name__ == "__main__":
    pass