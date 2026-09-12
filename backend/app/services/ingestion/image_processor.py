import uuid
import logging
from app.utils.ollama_client import describe_image

logger = logging.getLogger(__name__)

def process_image(file_path: str, role_access: str, file_name: str) -> dict:
    """
    Process an image by describing it via Ollama LLM
    """
    try:
        prompt = "Describe this diagram/image in detail. What does it show? What are the key components and relationships?"
        description = describe_image(file_path, prompt)
        
        chunk = {
            "chunk_id": str(uuid.uuid4()),
            "source_type": "diagram",
            "content": description,
            "role": role_access,
            "file_name": file_name,
            "metadata": {"is_image_description": True}
        }
        return chunk
    except Exception as e:
        logger.error(f"Error processing image {file_name}: {e}")
        raise e
