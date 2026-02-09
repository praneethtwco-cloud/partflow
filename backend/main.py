import os
import json
import base64
import traceback
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from database import init_db, create_user, authenticate_user

app = Flask(__name__)
CORS(app)

# Initialize Database (Warning: Data in /tmp is temporary on Vercel)
init_db()

# SECURITY: Basic API Key for internal bridge
API_KEY = "partflow_secret_token_2026"

def check_auth():
    auth_header = request.headers.get('X-API-KEY')
    if auth_header != API_KEY:
        return False
    return True

# Path to the JSON key (Fallback for local dev)
SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), 'config', 'service-account.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    creds = None
    
    # 1. Try to load from Base64 Environment Variable (Vercel Production Method)
    # You must set 'GOOGLE_CREDENTIALS_BASE64' in Vercel with the content of sa.b64
    b64_env = os.environ.get('GOOGLE_CREDENTIALS_BASE64')
    
    if b64_env:
        try:
            print("INFO: Loading credentials from Base64 Environment Variable...")
            # Decode Base64 to UTF-8 JSON string
            creds_json_str = base64.b64decode(b64_env).decode('utf-8')
            config = json.loads(creds_json_str)
            
            creds = service_account.Credentials.from_service_account_info(
                config, scopes=SCOPES)
                
        except Exception as e:
            print(f"CRITICAL: Failed to decode Base64 credentials: {e}")
            traceback.print_exc()

    # 2. Fallback to physical file (Local Dev Method)
    if not creds:
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            print("INFO: Loading credentials from local file...")
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        else:
            # Last ditch: Try the old raw JSON env var (Not recommended, but legacy support)
            raw_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')
            if raw_json:
                try:
                    config = json.loads(raw_json)
                    creds = service_account.Credentials.from_service_account_info(
                        config, scopes=SCOPES)
                except:
                    pass

    if not creds:
        raise FileNotFoundError("Could not find valid credentials in ENV (Base64) or File.")

    return build('sheets', 'v4', credentials=creds)

def ensure_headers(service, spreadsheet_id, sheet_name, headers):
    try:
        # Check if sheet exists
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        sheet_exists = any(s['properties']['title'] == sheet_name for s in sheets)

        # Create sheet if missing
        if not sheet_exists:
            body = {'requests': [{'addSheet': {'properties': {'title': sheet_name}}}]}
            service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

        # Check existing headers
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1:Z1").execute()
        
        existing_values = result.get('values', [[]])
        if not existing_values or not existing_values[0] or len(existing_values[0]) < len(headers):
            print(f"INFO: Updating headers for {sheet_name}")
            body = {'values': [headers]}
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1",
                valueInputOption='RAW', body=body).execute()
    except Exception as err:
        print(f"Error in ensure_headers for {sheet_name}: {err}")
        # Don't raise here, allow partial sync to proceed if one sheet fails
        pass

def sanitize_value(value):
    """Prevent formula injection"""
    if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
        return f"'{value}"
    return value

def upsert_rows(service, spreadsheet_id, sheet_name, headers, data, id_column_index=0):
    # Fetch existing
    range_name = f"'{sheet_name}'!A1:Z1000"

    try:
        result = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        rows = result.get('values', [])
    except:
        rows = []
    
    # 1. Force Header Match
    if not rows or not rows[0]:
        rows = [headers]
    else:
        # Case insensitive compare
        current = [str(h).strip().lower() for h in rows[0]]
        expected = [str(h).strip().lower() for h in headers]
        
        if current != expected:
            old_data = rows[1:]
            rows = [headers]
            for od in old_data:
                new_r = od[:len(headers)]
                while len(new_r) < len(headers): new_r.append('0')
                rows.append(new_r)

    # 2. Map Data
    if data:
        id_map = {str(row[id_column_index]): i for i, row in enumerate(rows) if i > 0 and len(row) > id_column_index}
        for new_row in data:
            # Sanitize input
            sanitized_row = [sanitize_value(cell) for cell in new_row]
            
            nid = str(sanitized_row[id_column_index])
            if nid in id_map: rows[id_map[nid]] = sanitized_row
            else: rows.append(sanitized_row)

    # 3. Write back
    rows[0] = headers
    body = {'values': rows}
    
    # Clear first
    service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1:Z").execute()
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1",
        valueInputOption='USER_ENTERED', body=body).execute()
    return True




@app.route('/health', methods=['GET'])
def health():
    # Diagnostic endpoint
    is_base64 = os.environ.get('GOOGLE_CREDENTIALS_BASE64') is not None
    return jsonify({
        "status": "ok",
        "version": "1.1.0-base64-fix",
        "server_time": datetime.datetime.now().isoformat(),
        "database_path": "/tmp/partflow.db" if os.environ.get('VERCEL') else "local",
        "auth_method": "Base64 Env" if is_base64 else "File/Legacy",
        "vercel_env": bool(os.environ.get('VERCEL'))
    })

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    full_name = data.get('full_name')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
        
    if create_user(username, password, full_name):
        return jsonify({"success": True, "message": "User registered successfully"})
    return jsonify({"success": False, "message": "Username already exists"}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = authenticate_user(data.get('username'), data.get('password'))
    if user:
        return jsonify({"success": True, "user": user, "token": API_KEY})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/sync', methods=['POST'])
def sync():
    if not check_auth(): return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    data = request.json
    spreadsheet_id = data.get('spreadsheetId')
    customers = data.get('customers', [])
    orders = data.get('orders', [])
    items = data.get('items', [])
    mode = data.get('mode', 'upsert')

    if not spreadsheet_id: return jsonify({"success": False, "message": "Spreadsheet ID is required"}), 400

    try:
        service = get_sheets_service()
        
        customer_headers = ['ID', 'Shop Name', 'Address', 'Phone', 'City', 'Discount 1', 'Discount 2', 'Balance', 'Credit Period', 'Status', 'Last Updated']
        inventory_headers = ['ID', 'Display Name', 'Internal Name', 'SKU', 'Vehicle', 'Brand/Origin', 'Category', 'Unit Value', 'Stock Qty', 'Low Stock Threshold', 'Out of Stock', 'Status', 'Last Updated']
        order_headers = ['Order ID', 'Customer ID', 'Rep ID', 'Date', 'Gross Total', 'Disc 1 Rate', 'Disc 1 Value', 'Disc 2 Rate', 'Disc 2 Value', 'Net Total', 'Paid', 'Balance Due', 'Payment Status', 'Delivery Status', 'Credit Period', 'Status', 'Last Updated']
        line_headers = ['Line ID', 'Order ID', 'Item ID', 'Item Name', 'Qty', 'Unit Price', 'Line Total']

        # Ensure Sheets Exist
        ensure_headers(service, spreadsheet_id, 'Customers', customer_headers)
        ensure_headers(service, spreadsheet_id, 'Inventory', inventory_headers)
        ensure_headers(service, spreadsheet_id, 'Orders', order_headers)
        ensure_headers(service, spreadsheet_id, 'OrderLines', line_headers)

        # --- Process Customers ---
        if customers:
            values = [[c['customer_id'], c['shop_name'], c['address'], c['phone'], c['city_ref'], c['discount_rate'], c.get('secondary_discount_rate', 0), c.get('outstanding_balance', 0), c.get('credit_period', 90), c['status'], c['updated_at']] for c in customers]
            if mode == 'overwrite':
                service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range="'Customers'!A1", valueInputOption="RAW", body={"values": [customer_headers]}).execute()
                service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range="'Customers'!A2:Z").execute()
                if values:
                    service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="'Customers'!A2", valueInputOption="USER_ENTERED", body={"values": values}).execute()
            else:
                upsert_rows(service, spreadsheet_id, 'Customers', customer_headers, values, 0)
        else:
            upsert_rows(service, spreadsheet_id, 'Customers', customer_headers, [], 0)

        # --- Process Inventory ---
        if items:
            values = [[i['item_id'], i['item_display_name'], i['item_name'], i['item_number'], i['vehicle_model'], i['source_brand'], i.get('category', 'Uncategorized'), i['unit_value'], i['current_stock_qty'], i.get('low_stock_threshold', 10), i.get('is_out_of_stock', False), i['status'], i['updated_at']] for i in items]
            if mode == 'overwrite':
                service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range="'Inventory'!A1", valueInputOption="RAW", body={"values": [inventory_headers]}).execute()
                service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range="'Inventory'!A2:Z").execute()
                service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="'Inventory'!A2", valueInputOption="USER_ENTERED", body={"values": values}).execute()
            else:
                upsert_rows(service, spreadsheet_id, 'Inventory', inventory_headers, values, 0)
        else:
            upsert_rows(service, spreadsheet_id, 'Inventory', inventory_headers, [], 0)

        # --- Process Orders ---
        if orders:
            order_values = [[o['order_id'], o['customer_id'], o.get('rep_id', ''), o['order_date'], o.get('gross_total', 0), o.get('discount_rate', 0), o.get('discount_value', 0), o.get('secondary_discount_rate', 0), o.get('secondary_discount_value', 0), o['net_total'], o.get('paid_amount', 0), o.get('balance_due', 0), o.get('payment_status', 'unpaid'), o.get('delivery_status', 'pending'), o.get('credit_period', 90), o['order_status'], o['updated_at']] for o in orders]
            if mode == 'overwrite':
                service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range="'Orders'!A1", valueInputOption="RAW", body={"values": [order_headers]}).execute()
                service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range="'Orders'!A2:Z").execute()
                service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="'Orders'!A2", valueInputOption="USER_ENTERED", body={"values": order_values}).execute()
            else:
                upsert_rows(service, spreadsheet_id, 'Orders', order_headers, order_values, 0)
            
            line_values = []
            for o in orders:
                for l in o.get('lines', []):
                    line_values.append([l['line_id'], o['order_id'], l['item_id'], l['item_name'], l['quantity'], l['unit_value'], l['line_total']])
            if line_values:
                upsert_rows(service, spreadsheet_id, 'OrderLines', line_headers, line_values, 0)
        else:
            upsert_rows(service, spreadsheet_id, 'Orders', order_headers, [], 0)

        # --- PULL ALL DATA ---
        
        # 1. Pull Inventory
        result = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'Inventory'!A:Z").execute()
        pulled_items = []
        rows = result.get('values', [])
        if len(rows) > 1:
            for row in rows[1:]:
                if not row or not row[0]: continue
                while len(row) < 13: row.append('')
                try: unit_val = float(row[7]) if row[7] else 0
                except: unit_val = 0
                pulled_items.append({
                    "item_id": str(row[0]), "item_display_name": str(row[1]), "item_name": str(row[2] or row[1]),
                    "item_number": str(row[3]), "vehicle_model": str(row[4]), "source_brand": str(row[5] or 'Unknown'),
                    "category": str(row[6] or 'Uncategorized'), "unit_value": unit_val, "current_stock_qty": int(row[8]) if row[8] else 0,
                    "low_stock_threshold": int(row[9]) if row[9] else 10, "is_out_of_stock": str(row[10]).lower() == 'true',
                    "status": str(row[11] or 'active'), "updated_at": str(row[12] or ''), "sync_status": 'synced'
                })

        # 2. Pull Customers
        result = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'Customers'!A:Z").execute()
        pulled_customers = []
        rows = result.get('values', [])
        if len(rows) > 1:
            for row in rows[1:]:
                if not row or not row[0]: continue
                while len(row) < 11: row.append('')
                try: disc1 = float(row[5]) if row[5] else 0
                except: disc1 = 0
                try: disc2 = float(row[6]) if row[6] else 0
                except: disc2 = 0
                try: bal = float(row[7]) if row[7] else 0
                except: bal = 0
                try: cpd = int(row[8]) if row[8] else 90
                except: cpd = 90
                pulled_customers.append({
                    "customer_id": str(row[0]), "shop_name": str(row[1]), "address": str(row[2]),
                    "phone": str(row[3]), "city_ref": str(row[4]), 
                    "discount_rate": disc1, "secondary_discount_rate": disc2,
                    "outstanding_balance": bal, "credit_period": cpd, "status": str(row[9] or 'active'),
                    "updated_at": str(row[10] or ''), "sync_status": 'synced'
                })

        # 3. Pull Orders & Lines
        result_orders = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'Orders'!A:Z").execute()
        result_lines = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'OrderLines'!A:Z").execute()
        
        pulled_orders = []
        order_rows = result_orders.get('values', [])
        line_rows = result_lines.get('values', [])
        
        # Map lines to orders
        lines_by_order = {}
        if len(line_rows) > 1:
            for row in line_rows[1:]:
                if len(row) < 7: continue
                oid = str(row[1])
                line = {
                    "line_id": str(row[0]), "order_id": oid, "item_id": str(row[2]),
                    "item_name": str(row[3]), "quantity": int(row[4]) if row[4] else 0,
                    "unit_value": float(row[5]) if row[5] else 0, "line_total": float(row[6]) if row[6] else 0
                }
                if oid not in lines_by_order: lines_by_order[oid] = []
                lines_by_order[oid].append(line)

        if len(order_rows) > 1:
            for row in order_rows[1:]:
                if not row or not row[0]: continue
                while len(row) < 17: row.append('')
                oid = str(row[0])
                # Sanitize input: clean formulas
                sanitized_row = [sanitize_value(cell) for cell in row]
                
                pulled_orders.append({
                    "order_id": sanitized_row[0], "customer_id": str(sanitized_row[1]), "rep_id": str(sanitized_row[2]), "order_date": str(sanitized_row[3]), 
                    "gross_total": float(sanitized_row[4]) if sanitized_row[4] else 0, "discount_rate": float(sanitized_row[5]) if sanitized_row[5] else 0, "discount_value": float(sanitized_row[6]) if sanitized_row[6] else 0,
                    "secondary_discount_rate": float(sanitized_row[7]) if sanitized_row[7] else 0, "secondary_discount_value": float(sanitized_row[8]) if sanitized_row[8] else 0,
                    "net_total": float(sanitized_row[9]) if sanitized_row[9] else 0, "paid_amount": float(sanitized_row[10]) if sanitized_row[10] else 0, "balance_due": float(sanitized_row[11]) if sanitized_row[11] else 0,
                    "payment_status": str(sanitized_row[12] or 'unpaid'), "delivery_status": str(sanitized_row[13] or 'pending'),
                    "credit_period": int(sanitized_row[14]) if sanitized_row[14] else 90, "order_status": str(sanitized_row[15] or 'confirmed'), "updated_at": str(sanitized_row[16] or ''),
                    "lines": lines_by_order.get(oid, []), "sync_status": 'synced'
                })

        return jsonify({"success": True, "pulledItems": pulled_items, "pulledCustomers": pulled_customers, "pulledOrders": pulled_orders, "debug": {"customer_header_len": len(customer_headers), "order_header_len": len(order_headers)}, "message": f"Sync completed successfully ({mode} mode)"})
    except Exception as e:

        print("SYNC ERROR:")
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
