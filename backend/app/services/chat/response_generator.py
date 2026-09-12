import logging
from typing import Dict, Any, Tuple, List
from app.utils.ollama_client import generate_response

logger = logging.getLogger(__name__)

def generate_response_for_chat(intent: str, context: Dict[str, Any], user_message: str, history: List[Dict]) -> Tuple[str, float, List[Dict]]:
    """
    Generate response using Ollama based on intent and retrieved context.
    Returns: (response_text, confidence_score, sources_list)
    """
    sources = []

    # Build detailed context string (use up to 8 results, full snippets)
    context_str = ""
    if context["raw_results"]:
        for idx, r in enumerate(context["raw_results"][:8]):
            context_str += (
                f"[{idx+1}] Type: {r['type']} | Source: {r['title']}\n"
                f"Relevance: {r['relevance_score']:.2f}\n"
                f"Content: {r['snippet']}\n\n"
            )
            sources.append({
                "id": r["id"],
                "type": r["type"],
                "title": r["title"]
            })

    has_context = bool(context_str.strip())
    history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-5:]])

    # Select system prompt based on intent
    if not has_context:
        sys_prompt = (
            "You are a helpful assistant for a software project management tool. "
            "There is no specific documentation or code indexed for this query yet. "
            "Be honest with the user that you don't have specific project context for this question. "
            "You can still answer general programming or project management questions, "
            "but be clear you are not drawing from the project's documents."
        )
    elif intent == "knowledge_qa":
        sys_prompt = (
            "You are a helpful assistant. Use ONLY the provided context below to answer the user's question. "
            "Cite your sources using [1], [2] format. "
            "If the context does not contain enough information, say so — do not invent details.\n\n"
            f"Context:\n{context_str}\n"
            f"Recent conversation:\n{history_str}"
        )
    elif intent == "task_create":
        sys_prompt = (
            "You are a helpful project manager assistant. "
            "The user wants to create a task. Acknowledge what task will be created, "
            "summarize its key details (title, description, priority), and confirm you've noted it."
        )
    elif intent == "task_query":
        sys_prompt = (
            "You are a project manager assistant. Use the context below to answer questions about tasks. "
            "List tasks clearly with their status and priority.\n\n"
            f"Context:\n{context_str}"
        )
    elif intent == "asset_search":
        sys_prompt = (
            "You are a senior developer assistant. Use the context below to find matching code assets. "
            "For each relevant asset, explain what it does and how to use it. "
            "Cite using [1], [2] format.\n\n"
            f"Context:\n{context_str}"
        )
    elif intent == "project_summary":
        sys_prompt = (
            "You are a technical lead. Summarize the project based on the indexed documents and assets below. "
            "Highlight key technologies, components, and patterns found.\n\n"
            f"Context:\n{context_str}"
        )
    elif intent == "project_overview":
        sys_prompt = (
            "You are a senior technical lead with access to repository metadata and README content. "
            "Answer the user's question about what the project does, its architecture, languages, "
            "entry points, and key directories. Be specific — cite actual file names, folder names, "
            "and languages from the context. Do NOT say you don't have information if the context "
            "provides it.\n\n"
            f"Context:\n{context_str}\n"
            f"Recent conversation:\n{history_str}"
        )
    else:
        sys_prompt = (
            f"You are a helpful assistant. Use the context below if relevant.\n\n"
            f"Context:\n{context_str}\n"
            f"Recent conversation:\n{history_str}"
        )

    prompt = f"{sys_prompt}\n\nUser: {user_message}\nAssistant:"

    try:
        res = generate_response(prompt, model="mistral:7b")
        response = res['response']
        confidence = 0.85 if has_context else 0.4
        logger.info(f"Response generated. Sources used: {len(sources)}, has_context: {has_context}")
        return response, confidence, sources
    except Exception as e:
        logger.error(f"Failed to generate response: {e}", exc_info=True)
        return "I'm sorry, I encountered an error generating a response. Please try again.", 0.0, []
