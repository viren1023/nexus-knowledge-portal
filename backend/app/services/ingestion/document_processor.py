import os
import uuid
import logging
import pdfplumber
import docx
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

def detect_file_type(file_name: str) -> str:
    ext = file_name.split('.')[-1].lower()
    if ext == 'pdf':
        return 'pdf'
    elif ext in ['doc', 'docx']:
        return 'word'
    elif ext in ['md', 'markdown']:
        return 'markdown'
    elif ext in ['txt']:
        return 'text'
    elif ext in ['png', 'jpg', 'jpeg']:
        return 'image'
    return 'unknown'

def extract_text(file_path: str, file_type: str) -> Tuple[str, Dict]:
    text = ""
    metadata = {}
    try:
        if file_type == 'pdf':
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        elif file_type == 'word':
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif file_type in ['markdown', 'text']:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        elif file_type == 'image':
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)
    except Exception as e:
        logger.error(f"Error extracting text from {file_path}: {e}")
        raise e
        
    return text, metadata

def detect_structure(text: str, file_type: str) -> Dict[str, Any]:
    # Simplified structure detection
    lines = text.split('\n')
    headers = []
    code_blocks = []
    
    in_code_block = False
    current_code_block = ""
    
    for idx, line in enumerate(lines):
        # Markdown headers
        if line.startswith('#'):
            headers.append({"level": line.count('#'), "text": line.strip('# ').strip(), "line_idx": idx})
            
        # Code blocks
        if line.startswith('```'):
            if in_code_block:
                in_code_block = False
                code_blocks.append(current_code_block)
                current_code_block = ""
            else:
                in_code_block = True
                continue
                
        if in_code_block:
            current_code_block += line + "\n"
            
    return {
        "headers": headers,
        "code_blocks": code_blocks,
        "has_structure": len(headers) > 0
    }

def smart_chunking(text: str, structure: Dict[str, Any], max_tokens: int = 800, overlap: int = 100) -> List[Dict[str, Any]]:
    # Simplified chunking logic (token roughly = 4 characters)
    # Using characters for simplicity, 1 token approx 4 chars
    max_chars = max_tokens * 4
    overlap_chars = overlap * 4
    
    chunks = []
    
    if structure.get("has_structure"):
        # Split by H2 boundaries if present
        h2_headers = [h for h in structure['headers'] if h['level'] == 2]
        if h2_headers:
            lines = text.split('\n')
            current_chunk = ""
            current_header = "Intro"
            
            h2_indices = {h['line_idx']: h['text'] for h in h2_headers}
            
            for idx, line in enumerate(lines):
                if idx in h2_indices:
                    if current_chunk.strip():
                        chunks.append({"path": current_header, "content": current_chunk})
                    current_header = h2_indices[idx]
                    current_chunk = line + "\n"
                else:
                    current_chunk += line + "\n"
                    
            if current_chunk.strip():
                chunks.append({"path": current_header, "content": current_chunk})
        else:
            chunks = _basic_chunk(text, max_chars, overlap_chars)
    else:
        chunks = _basic_chunk(text, max_chars, overlap_chars)
        
    return chunks

def _basic_chunk(text: str, max_chars: int, overlap_chars: int) -> List[Dict[str, Any]]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        # Try to find a nice break point
        if end < len(text):
            # look for a newline near the end
            last_newline = text.rfind('\n', start, end)
            if last_newline != -1 and last_newline > start + (max_chars // 2):
                end = last_newline + 1
        
        chunks.append({"path": "", "content": text[start:end]})
        start = end - overlap_chars if end < len(text) else len(text)
    return chunks

def process_document(document_id: str, file_path: str, role_access: str, file_name: str) -> List[Dict[str, Any]]:
    file_type = detect_file_type(file_name)
    
    text, _ = extract_text(file_path, file_type)
    structure = detect_structure(text, file_type)
    raw_chunks = smart_chunking(text, structure)
    
    final_chunks = []
    for order, chunk in enumerate(raw_chunks):
        final_chunks.append({
            "chunk_id": str(uuid.uuid4()),
            "document_id": document_id,
            "chunk_order": order + 1,
            "source_type": "document",
            "file_name": file_name,
            "chunk_path": chunk["path"],
            "role": role_access,
            "content": chunk["content"],
            "metadata": {"contains_code": "```" in chunk["content"]}
        })
        
    return final_chunks
