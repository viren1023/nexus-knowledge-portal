import logging
from functools import lru_cache
from app.utils.ollama_client import generate_embedding

logger = logging.getLogger(__name__)

# Basic in-memory cache to avoid recomputing embeddings for same text
_embedding_cache = {}

def get_embedding(text: str, model: str = "nomic-embed-text") -> list[float]:
    """
    Get an embedding for the given text, with caching.
    """
    if not text or not text.strip():
        logger.warning("Attempted to embed empty text, returning zeros")
        return [0.0] * 768  # nomic-embed-text produces 768-dim vectors
        
    cache_key = f"{model}:{hash(text)}"
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]
        
    try:
        embedding = generate_embedding(text, model)
        _embedding_cache[cache_key] = embedding
        return embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        raise e
