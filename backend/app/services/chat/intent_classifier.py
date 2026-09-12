import logging
import json
import re
from app.utils.ollama_client import generate_response

logger = logging.getLogger(__name__)

INTENTS = [
    "knowledge_qa",
    "task_create",
    "task_confirm",
    "task_update",
    "task_cancel",
    "task_query",
    "asset_search",
    "project_summary",
    "project_overview",
    "unknown"
]

AFFIRMATIVE_PHRASES = {
    "yes", "yeah", "yep", "sure", "ok", "okay", "create", "create it",
    "proceed", "go ahead", "looks good", "confirm", "do it", "approved",
    "fine", "yes please", "yes create", "yes create it", "yes do it",
    "sounds good", "perfect", "all good", "correct", "yup", "aye"
}

CANCEL_PHRASES = {
    "no", "cancel", "never mind", "nevermind", "abort", "stop",
    "don't create", "dont create", "discard", "no cancel", "no thanks",
    "never mind cancel", "cancel it", "cancel task"
}

UPDATE_KEYWORDS = [
    "change", "update", "set", "make it", "modify", "assign to",
    "priority to", "instead", "no, change", "no change", "also add",
    "edit", "rename", "increase", "decrease", "due date", "estimate"
]


def classify_intent(message: str, has_pending_task: bool = False) -> str:
    """
    Classify the intent of a user message.
    If has_pending_task is True, prioritizes confirmation, modification, or cancellation.
    """
    msg_clean = message.strip().lower()

    # If there is an active pending task, evaluate confirmation / cancellation / modification first
    if has_pending_task:
        # Check direct match or prefixes for affirmation
        if msg_clean in AFFIRMATIVE_PHRASES:
            return "task_confirm"
        if re.match(r"^(yes|sure|ok|okay|yep|yeah)\b", msg_clean) and not any(kw in msg_clean for kw in ["change", "but", "update", "modify", "instead"]):
            return "task_confirm"

        # Check cancellation
        if msg_clean in CANCEL_PHRASES:
            return "task_cancel"
        if re.match(r"^(no\b|cancel\b|stop\b|abort\b)", msg_clean) and not any(kw in msg_clean for kw in UPDATE_KEYWORDS):
            return "task_cancel"

        # Check modifications
        if any(kw in msg_clean for kw in UPDATE_KEYWORDS):
            return "task_update"

    prompt = f"""
    Analyze the following user message and classify it into exactly one of these intents:
    - knowledge_qa: Asking a general question about documentation, codebase, or how something works.
    - task_create: Asking to create, draft, or add a new task, ticket, or todo item. Examples: "Create a task for...", "Add a task to...", "We need a ticket to fix login", "Can you create a task for this?"
    - task_query: Asking about the status of tasks, what tasks exist, or who is assigned to what. Examples: "What tasks are open?", "Show me tasks", "Who is working on what?"
    - asset_search: Asking to find specific code components, reusable assets, or functions.
    - project_summary: Asking for a high-level summary of a project.
    - project_overview: Asking what the project is about, its structure, its purpose, entry points, or main components.
    
    User Message: "{message}"
    
    Respond with ONLY the intent string from the list above. No other text.
    """

    try:
        res = generate_response(prompt, model="mistral:7b")
        response = res['response']
        intent = response.strip().lower()

        for i in INTENTS:
            if i in intent:
                return i

        return "knowledge_qa"
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        return "knowledge_qa"
