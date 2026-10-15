"""
AI Service Configuration
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017/log_anomaly_platform"

    # API Security
    api_key: str = "dev-ai-service-key-change-me"

    # LLM Provider
    llm_provider: str = "mock"  # openai | azure | ollama | mock
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Model
    model_device: str = "cpu"
    anomaly_threshold: float = 0.35

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
