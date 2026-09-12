import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from redis import Redis
from rq import Queue

load_dotenv()

class Settings(BaseSettings):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_NAME: str = os.getenv("DB_NAME", "knowledge_portal")
    
    @property
    def DATABASE_URL(self) -> str:
        # Use explicit env var if set (avoids URL-encoding issues with special chars in password)
        explicit = os.getenv("DATABASE_URL")
        if explicit:
            return explicit
        from urllib.parse import quote_plus
        password = quote_plus(self.DB_PASSWORD)
        return f"postgresql://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Redis & RQ
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # Ollama
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "nexus-super-secret-jwt-key-2024")

settings = Settings()

# Redis Connection setup
def get_redis_connection() -> Redis:
    return Redis.from_url(settings.REDIS_URL)

# RQ Queue setup
def get_ingestion_queue() -> Queue:
    conn = get_redis_connection()
    return Queue(name='ingestion', connection=conn)
