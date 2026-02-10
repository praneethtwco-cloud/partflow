import os
import uuid
import datetime
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from api.utils import get_sheets_service
import api.database as sqlite_db

# Configuration
AUTH_SHEET_ID = os.environ.get('GOOGLE_SHEET_ID')
USERS_SHEET_NAME = 'Users'
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev_jwt_secret_change_me')
JWT_EXPIRATION_HOURS = 24

def get_auth_mode():
    if AUTH_SHEET_ID and get_sheets_service():
        return 'sheets'
    return 'sqlite'

def init_auth():
    mode = get_auth_mode()
    print(f"Initializing Auth System. Mode: {mode}")
    
    if mode == 'sqlite':
        return sqlite_db.init_db()
        
    # Sheets Mode Initialization
    service = get_sheets_service()
    try:
        # Check if Users sheet exists
        spreadsheet = service.spreadsheets().get(spreadsheetId=AUTH_SHEET_ID).execute()
        sheets = spreadsheet.get('sheets', [])
        sheet_exists = any(s['properties']['title'] == USERS_SHEET_NAME for s in sheets)
        
        if not sheet_exists:
            # Create Users Sheet
            body = {'requests': [{'addSheet': {'properties': {'title': USERS_SHEET_NAME}}}]}
            service.spreadsheets().batchUpdate(spreadsheetId=AUTH_SHEET_ID, body=body).execute()
            
            # Add Headers
            headers = [['ID', 'Username', 'Password Hash', 'Full Name', 'Role', 'Status', 'Created At']]
            service.spreadsheets().values().update(
                spreadsheetId=AUTH_SHEET_ID, 
                range=f"'{USERS_SHEET_NAME}'!A1", 
                valueInputOption='RAW', 
                body={'values': headers}
            ).execute()
            
            # Create Default Admin
            # SECURITY: Use a strong default password if env var not set
            admin_pw = os.environ.get('ADMIN_DEFAULT_PASSWORD', 'admin123') 
            create_user_sheets('admin', admin_pw, 'Administrator', 'admin')
            
    except Exception as e:
        print(f"Failed to initialize Auth Sheet: {e}")

def generate_token(user_id, username, role):
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.datetime.utcnow(),
        'sub': str(user_id),
        'username': username,
        'role': role
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def _get_all_users_sheet():
    service = get_sheets_service()
    if not service: return []
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=AUTH_SHEET_ID, range=f"'{USERS_SHEET_NAME}'!A:G"
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2: return [] # Only headers
        
        users = []
        for i, row in enumerate(rows[1:]):
            # Pad row if incomplete
            while len(row) < 6: row.append('')
            users.append({
                'row_idx': i + 2, # 1-based index, +1 for header
                'id': row[0],
                'username': row[1],
                'password_hash': row[2],
                'full_name': row[3],
                'role': row[4],
                'status': row[5]
            })
        return users
    except Exception as e:
        print(f"Error reading users sheet: {e}")
        return []

def create_user_sheets(username, password, full_name=None, role='rep'):
    service = get_sheets_service()
    users = _get_all_users_sheet()
    
    # Check duplicate
    if any(u['username'].lower() == username.lower() for u in users):
        return False
        
    password_hash = generate_password_hash(password)
    user_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    
    row = [user_id, username, password_hash, full_name or '', role, 'active', created_at]
    
    try:
        service.spreadsheets().values().append(
            spreadsheetId=AUTH_SHEET_ID,
            range=f"'{USERS_SHEET_NAME}'!A1",
            valueInputOption='USER_ENTERED',
            body={'values': [row]}
        ).execute()
        return True
    except Exception as e:
        print(f"Error creating user in sheet: {e}")
        return False

def authenticate_user_sheets(username, password):
    users = _get_all_users_sheet()
    user = next((u for u in users if u['username'].lower() == username.lower()), None)
    
    if user and user['status'] == 'active' and check_password_hash(user['password_hash'], password):
        token = generate_token(user['id'], user['username'], user['role'])
        return {
            "id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "role": user['role'],
            "token": token
        }
    return None

def update_password_sheets(user_id, old_password, new_password):
    users = _get_all_users_sheet()
    user = next((u for u in users if u['id'] == user_id), None)
    
    if not user:
        return False, "User not found"
        
    if not check_password_hash(user['password_hash'], old_password):
        return False, "Incorrect old password"
        
    new_hash = generate_password_hash(new_password)
    
    # Update specifically the Password Hash column (Column C) for this row
    row_idx = user['row_idx']
    range_name = f"'{USERS_SHEET_NAME}'!C{row_idx}"
    
    try:
        service = get_sheets_service()
        service.spreadsheets().values().update(
            spreadsheetId=AUTH_SHEET_ID,
            range=range_name,
            valueInputOption='RAW',
            body={'values': [[new_hash]]}
        ).execute()
        return True, "Password updated successfully"
    except Exception as e:
        return False, str(e)

# --- Public Interface (Facade) ---

def create_user(username, password, full_name=None, role='rep'):
    if get_auth_mode() == 'sheets':
        return create_user_sheets(username, password, full_name, role)
    return sqlite_db.create_user(username, password, full_name, role)

def authenticate_user(username, password):
    if get_auth_mode() == 'sheets':
        return authenticate_user_sheets(username, password)
    
    # SQLite Fallback
    user = sqlite_db.authenticate_user(username, password)
    if user:
        token = generate_token(user['id'], user['username'], user['role'])
        user['token'] = token
        return user
    return None

def update_user_password(user_id, old_password, new_password):
    if get_auth_mode() == 'sheets':
        return update_password_sheets(user_id, old_password, new_password)
    return sqlite_db.update_user_password(user_id, old_password, new_password)
