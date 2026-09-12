from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.auth import verify_token
import logging

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Exclude specific paths from auth
        if request.url.path.startswith("/api/auth/login") or request.url.path.startswith("/api/auth/users") or request.url.path == "/health" or request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
            return await call_next(request)
        
        # We need to bypass auth for OPTIONS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)
            
        auth_header = request.headers.get("Authorization")
        token = None
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.query_params.get("token"):
            token = request.query_params.get("token")
            
        if not token:
            return JSONResponse({"error": "Unauthorized - Missing token"}, status_code=401)
        
        try:
            payload = verify_token(token)
            if not payload:
                return JSONResponse({"error": "Token expired or invalid"}, status_code=401)
            
            # Inject user context into request state
            request.state.user_id = payload.get("user_id")
            request.state.user_role = payload.get("role")
        except IndexError:
            return JSONResponse({"error": "Invalid token format"}, status_code=401)
        except Exception as e:
            logger.error(f"Auth error: {str(e)}")
            return JSONResponse({"error": "Authentication failed"}, status_code=401)
        
        return await call_next(request)
