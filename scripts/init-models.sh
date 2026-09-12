#!/bin/bash

# Wait for Ollama service to be healthy
echo "Waiting for Ollama to boot..."
until curl -s http://localhost:11434/api/version > /dev/null; do
  sleep 2
done

echo "Ollama is running. Pulling required models..."

echo "1. Pulling Mistral (Text/Chat generation)..."
curl -X POST http://localhost:11434/api/pull -d '{"name": "mistral"}'

echo "2. Pulling LLaVA (Vision/Image processing)..."
curl -X POST http://localhost:11434/api/pull -d '{"name": "llava"}'

echo "3. Pulling nomic-embed-text (Embeddings generation)..."
curl -X POST http://localhost:11434/api/pull -d '{"name": "nomic-embed-text"}'

echo "All required models have been successfully downloaded!"
