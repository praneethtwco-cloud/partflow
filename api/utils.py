import os
import json
import base64
from google.oauth2 import service_account
from googleapiclient.discovery import build
from flask import request

# Shared Configuration
# Use Env Var for API Key if available, else fallback to hardcoded (for now, will deprecate)
API_KEY = os.environ.get('VITE_API_KEY', "partflow_secret_token_2026_v2")

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), 'config', 'service-account.json')

def check_auth():
    auth_header = request.headers.get('X-API-KEY')
    return auth_header == API_KEY

def get_google_config():
    """Helper to get and normalize Google config from Env or File"""
    config = None
    source = "none"
    
    # 1. Try standard Environment Variable (Raw JSON)
    env_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if env_json:
        try:
            cleaned = env_json.strip()
            # Remove potential quote wrapping
            if (cleaned.startswith("'") and cleaned.endswith("'")) or (cleaned.startswith('"') and cleaned.endswith('"')):
                cleaned = cleaned[1:-1].strip()
            config = json.loads(cleaned)
            source = "env_json"
        except Exception as e:
            print(f"ERROR: Environment JSON parsing failed: {e}")

    # 2. Try Base64 encoding (Fail-proof Vercel method)
    if not config:
        b64_data = os.environ.get('GOOGLE_SERVICE_ACCOUNT_B64')
        if b64_data:
            try:
                # Clean up potential whitespace
                b64_cleaned = "".join(b64_data.split())
                decoded = base64.b64decode(b64_cleaned).decode('utf-8')
                config = json.loads(decoded)
                source = "env_b64"
            except Exception as e:
                print(f"ERROR: Base64 decoding failed: {e}")

    # 3. Fallback to physical file
    if not config and os.path.exists(SERVICE_ACCOUNT_FILE):
        try:
            with open(SERVICE_ACCOUNT_FILE, 'r') as f:
                config = json.load(f)
                source = "file"
        except Exception as e:
            print(f"ERROR: File JSON parsing failed: {e}")
            
    # Normalize private key
    if config and 'private_key' in config:
        key = config['private_key']
        if isinstance(key, str):
            if '\\n' in key:
                key = key.replace('\\n', '\n')
            key = key.strip()
            if key.startswith('"') and key.endswith('"'):
                key = key[1:-1].strip()
            if key.startswith("'") and key.endswith("'"):
                key = key[1:-1].strip()
            config['private_key'] = key
        
    return config, source

def get_sheets_service():
    """Returns an authorized Google Sheets service object"""
    config, _ = get_google_config()
    if not config:
        # Return None instead of raising immediately to allow graceful fallback/error handling
        return None
    
    try:
        creds = service_account.Credentials.from_service_account_info(
            config, scopes=SCOPES)
        return build('sheets', 'v4', credentials=creds)
    except Exception as e:
        print(f"AUTHENTICATION ERROR: {e}")
        return None
