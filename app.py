import asyncio
import json
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Literal

from dotenv import load_dotenv
from hypercorn.asyncio import serve
from hypercorn.config import Config
from quart import Quart, jsonify, render_template, request

from ai_service import AIProviderError, generate_ai_response, generate_chat_title

BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = Path(os.getenv("CHAT_STORE_PATH") or ("/tmp/chat_store.json" if os.getenv("VERCEL") else BASE_DIR / "chat_store.json"))
MAX_CHATS_PER_USER = 3

load_dotenv(BASE_DIR / ".env")

app = Quart(__name__)

Role = Literal["assistant", "user"]


@dataclass
class Message:
    role: Role
    content: str
    timestamp: str
    elapsed_seconds: float | None = None


@dataclass
class Chat:
    id: str
    title: str
    messages: list[Message] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: now_iso())
    updated_at: str = field(default_factory=lambda: now_iso())


chat_store: dict[str, list[Chat]] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_user_id() -> str:
    session_id = request.headers.get("X-User-Session-ID", "").strip()
    return session_id or request.remote_addr or "anonymous"


def default_message() -> Message:
    return Message(
        role="assistant",
        content="Hi! I'm bearCode. Ask me about code, product ideas, debugging, or anything you want to build.",
        timestamp=now_iso(),
    )


def create_chat() -> Chat:
    return Chat(
        id=f"chat_{uuid.uuid4().hex}",
        title="New conversation",
        messages=[default_message()],
    )


def load_store() -> None:
    if not STORE_PATH.exists():
        return

    try:
        raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    for user_id, chats in raw.items():
        if not isinstance(chats, list):
            continue

        parsed_chats = []
        for item in chats:
            if not isinstance(item, dict):
                continue

            messages = []
            for message in item.get("messages", []):
                if not isinstance(message, dict):
                    continue
                role = message.get("role")
                content = message.get("content")
                timestamp = message.get("timestamp") or now_iso()
                elapsed_seconds = message.get("elapsed_seconds")
                if role in {"assistant", "user"} and isinstance(content, str):
                    messages.append(
                        Message(
                            role=role,
                            content=content,
                            timestamp=timestamp,
                            elapsed_seconds=elapsed_seconds if isinstance(elapsed_seconds, (int, float)) else None,
                        )
                    )

            parsed_chats.append(
                Chat(
                    id=str(item.get("id") or f"chat_{len(parsed_chats)}"),
                    title=str(item.get("title") or "New conversation"),
                    messages=messages or [default_message()],
                    created_at=str(item.get("created_at") or now_iso()),
                    updated_at=str(item.get("updated_at") or now_iso()),
                )
            )

        chat_store[user_id] = sort_chats(parsed_chats)[:MAX_CHATS_PER_USER]


def save_store() -> None:
    data = {
        user_id: [serialize_chat(chat, include_messages=True) for chat in sort_chats(chats)[:MAX_CHATS_PER_USER]]
        for user_id, chats in chat_store.items()
    }
    STORE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sort_chats(chats: list[Chat]) -> list[Chat]:
    return sorted(chats, key=lambda chat: chat.updated_at, reverse=True)


def trim_user_chats(user_id: str) -> None:
    chat_store[user_id] = sort_chats(chat_store.get(user_id, []))[:MAX_CHATS_PER_USER]


def get_user_chats(user_id: str) -> list[Chat]:
    chats = chat_store.setdefault(user_id, [])
    if not chats:
        chats.append(create_chat())
        trim_user_chats(user_id)
        save_store()
    return chat_store[user_id]


def get_chat(user_id: str, chat_id: str | None = None) -> Chat:
    chats = get_user_chats(user_id)
    if chat_id:
        for chat in chats:
            if chat.id == chat_id:
                return chat

    return sort_chats(chats)[0]


def touch_chat(user_id: str, chat: Chat) -> None:
    chat.updated_at = now_iso()
    trim_user_chats(user_id)
    save_store()


def serialize_chat(chat: Chat, include_messages: bool = False) -> dict:
    data = {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
    }
    if include_messages:
        data["messages"] = [asdict(message) for message in chat.messages]
    return data


def serialize_chats(user_id: str) -> list[dict]:
    return [serialize_chat(chat) for chat in sort_chats(get_user_chats(user_id))]


def model_history(chat: Chat) -> list[dict[str, str]]:
    return [
        {"role": message.role, "content": message.content}
        for message in chat.messages
        if message.role in {"user", "assistant"} and message.content.strip()
    ]


async def refresh_chat_title(chat: Chat, force: bool = False) -> None:
    if chat.title != "New conversation" and not force:
        return

    dialogue = [message for message in chat.messages if message.role == "user"]
    if not dialogue:
        return

    try:
        chat.title = await generate_chat_title(model_history(chat))
    except AIProviderError:
        chat.title = fallback_title(chat)
    except Exception:
        chat.title = fallback_title(chat)


def fallback_title(chat: Chat) -> str:
    for message in chat.messages:
        if message.role == "user" and message.content.strip():
            content = re.sub(r"https?://\S+", "", message.content.strip())
            content = re.sub(r"^(поищи|найди|загугли|расскажи|напиши|дай|сделай|что это|what is|search|find|tell me)\s+", "", content, flags=re.IGNORECASE)
            words = content.split()
            title = " ".join(words[:5]).strip(".,:;!?")
            return title[:48] or "New conversation"
    return "New conversation"


async def refresh_chat_title_background(user_id: str, chat_id: str) -> None:
    try:
        target_chat = get_chat(user_id, chat_id)
        old_title = target_chat.title
        await refresh_chat_title(target_chat, force=True)
        if target_chat.title != old_title:
            save_store()
    except Exception as exc:
        print(f"Chat title refresh failed: {exc}")


@app.get("/")
async def index():
    return await render_template("index.html")


@app.get("/privacy-policy")
async def privacy_policy():
    return await render_template("privacy-policy.html")


@app.get("/api/chats")
async def chats():
    user_id = get_user_id()
    active_chat = get_chat(user_id)
    return jsonify({"chats": serialize_chats(user_id), "active_chat_id": active_chat.id})


@app.get("/api/history")
async def history():
    user_id = get_user_id()
    chat_id = request.args.get("chat_id")
    chat = get_chat(user_id, chat_id)
    return jsonify({"chat": serialize_chat(chat, include_messages=True), "chats": serialize_chats(user_id)})


@app.post("/api/chat")
async def chat():
    data = await request.get_json(silent=True) or {}
    chat_id = str(data.get("chat_id") or "").strip() or None
    user_message = str(data.get("message") or "").strip()

    if not user_message:
        return jsonify({"error": "Type a message before sending."}), 400

    user_id = get_user_id()
    current_chat = get_chat(user_id, chat_id)
    history_for_model = model_history(current_chat)

    current_chat.messages.append(Message(role="user", content=user_message, timestamp=now_iso()))

    try:
        started_at = perf_counter()
        response = await generate_ai_response(user_message, history_for_model)
        elapsed_seconds = round(perf_counter() - started_at, 2)
    except asyncio.CancelledError:
        raise
    except AIProviderError as exc:
        print(f"AI response failed: {exc}")
        current_chat.messages.pop()
        return jsonify({"error": "bearCode could not answer right now. Please try again."}), 502
    except Exception:
        current_chat.messages.pop()
        return jsonify({"error": "Something went wrong while generating a response."}), 500

    current_chat.messages.append(
        Message(
            role="assistant",
            content=response,
            timestamp=now_iso(),
            elapsed_seconds=elapsed_seconds,
        )
    )
    if current_chat.title == "New conversation":
        current_chat.title = fallback_title(current_chat)
    touch_chat(user_id, current_chat)
    asyncio.create_task(refresh_chat_title_background(user_id, current_chat.id))

    return jsonify(
        {
            "response": response,
            "elapsed_seconds": elapsed_seconds,
            "chat": serialize_chat(current_chat, include_messages=True),
            "chats": serialize_chats(user_id),
            "timestamp": current_chat.messages[-1].timestamp,
        }
    )


@app.post("/api/clear")
async def clear_chat():
    data = await request.get_json(silent=True) or {}
    user_id = get_user_id()
    chat_id = str(data.get("chat_id") or "").strip() or None
    current_chat = get_chat(user_id, chat_id)
    current_chat.title = "New conversation"
    current_chat.messages = [default_message()]
    touch_chat(user_id, current_chat)
    return jsonify({"status": "success", "chat": serialize_chat(current_chat, include_messages=True), "chats": serialize_chats(user_id)})


@app.post("/api/new")
async def new_chat():
    user_id = get_user_id()
    new_item = create_chat()
    chat_store.setdefault(user_id, []).insert(0, new_item)
    trim_user_chats(user_id)
    save_store()
    return jsonify({"status": "success", "chat": serialize_chat(new_item, include_messages=True), "chats": serialize_chats(user_id)})


@app.errorhandler(404)
async def not_found(_error):
    return jsonify({"error": "Route not found."}), 404


@app.errorhandler(405)
async def method_not_allowed(_error):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
async def server_error(_error):
    return jsonify({"error": "Internal server error."}), 500


load_store()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    config = Config()
    config.bind = [f"127.0.0.1:{port}"]
    config.use_reloader = os.getenv("ENVIRONMENT") != "production"
    print(f"bearCode is running at http://127.0.0.1:{port}")
    asyncio.run(serve(app, config))
