import os 
import logging 
from ollama import Client 
from config import settings

logger = logging.getLogger(__name__)

# Explicitly configure Ollama client
OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL or os.getenv(
    "OLLAMA_BASE_URL",
    "http://localhost:11434"
)

ollama_client = Client(host=OLLAMA_BASE_URL)


def generate_embedding(
    text: str,
    model: str = "nomic-embed-text:latest"
) -> list[float]:
    """
    Generate an embedding for the given text using Ollama.
    """
    try:
        response = ollama_client.embeddings(model=model, prompt=text)
        return response['embedding']
    except Exception as e:
        logger.error(f"Error generating embedding with model {model}: {str(e)}")
        raise e

def generate_response(prompt: str, model: str = "mistral:7b", system: str = None) -> dict:
    """
    Generate a response from Ollama.
    """
    try:
        options = {}
        if system:
            options['system'] = system
            
        response = ollama_client.generate(model=model, prompt=prompt, options=options)
        return {
            "response": response['response'],
            "context": response.get('context', []),
            "done": response['done']
        }
    except Exception as e:
        logger.error(f"Error generating response with model {model}: {str(e)}")
        raise e

def generate_response_stream(prompt: str, model: str = "mistral:7b", system: str = None):
    """
    Generate a streaming response from Ollama yielding token chunks.
    """
    try:
        options = {}
        if system:
            options['system'] = system
            
        stream = ollama_client.generate(model=model, prompt=prompt, options=options, stream=True)
        for chunk in stream:
            token = chunk.get('response', '')
            if token:
                yield token
    except Exception as e:
        logger.error(f"Error streaming response with model {model}: {str(e)}")
        raise e

def describe_image(image_path: str, prompt: str, model: str = "llava:7b") -> str:
    """
    Describe an image using Ollama's vision model.
    """
    try:
        with open(image_path, 'rb') as file:
            image_bytes = file.read()
            
        response = ollama_client.generate(
            model=model,
            prompt=prompt,
            images=[image_bytes]
        )
        return response['response']
    except Exception as e:
        logger.error(f"Error describing image with model {model}: {str(e)}")
        raise e
