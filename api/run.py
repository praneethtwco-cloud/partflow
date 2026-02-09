import os
import sys
import json
import traceback
import datetime
import base64

# --- Path Setup ---
# Allow imports from 'api' package by adding parent directory to path
CURRENT_DIR = os.path.dirname(__file__)
PARENT_DIR = os.path.dirname(CURRENT_DIR)
if PARENT_DIR not in sys.path:
    sys.path.append(PARENT_DIR)

if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from flask import Flask, request, jsonify
from flask_cors import CORS
from api.utils import get_sheets_service, get_google_config, check_auth as check_api_key, API_KEY
from api.auth_service import init_auth, create_user, authenticate_user, update_user_password

app = Flask(__name__)
CORS(app)

# Initialize Auth System
init_auth()

def check_auth():
    return check_api_key()

def ensure_headers(service, spreadsheet_id, sheet_name, headers):
    try:
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        sheet_exists = any(s['properties']['title'] == sheet_name for s in sheets)

        if not sheet_exists:
            body = {'requests': [{'addSheet': {'properties': {'title': sheet_name}}}]}
            service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()
    except Exception as err:
        print(f"Error creating sheet {sheet_name}: {err}")
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

    rows[0] = headers
    body = {'values': rows}
    
    service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1:Z").execute()
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A1",
        valueInputOption='USER_ENTERED', body=body).execute()
    return True

# --- API Routes ---

@app.route('/health', methods=['GET'])
def health():
    config, source = get_google_config()
    now = datetime.datetime.now(datetime.timezone.utc)
    diag = {
        "status": "ok",
        "version": "1.2.1-forced-header-v2",
        "server_time_utc": now.isoformat(),
        "credentials_source": source,
        "config_check": {"customers": 11, "orders": 17}
    }
    return jsonify(diag)

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username, password, full_name = data.get('username'), data.get('password'), data.get('full_name')
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    if create_user(username, password, full_name):
        return jsonify({"success": True, "message": "User registered successfully"})
    return jsonify({"success": False, "message": "Username already exists"}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = authenticate_user(data.get('username'), data.get('password'))
    if user: return jsonify({"success": True, "user": user, "token": API_KEY})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/change-password', methods=['POST'])
def change_password():
    if not check_auth(): return jsonify({"success": False, "message": "Unauthorized API Access"}), 401
    
    data = request.json
    user_id = data.get('userId')
    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')
    
    if not all([user_id, old_password, new_password]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    success, message = update_user_password(user_id, old_password, new_password)
    if success:
        return jsonify({"success": True, "message": message})
    return jsonify({"success": False, "message": message}), 400

@app.route('/cron/keepalive', methods=['GET'])
def keepalive():



    return jsonify({"status": "alive", "timestamp": datetime.datetime.now().isoformat()})

@app.route('/sync', methods=['POST'])
def sync():
    if not check_auth(): return jsonify({"success": False, "message": "Unauthorized"}), 401
    data = request.json
    spreadsheet_id = data.get('spreadsheetId')
    customers, orders, items = data.get('customers', []), data.get('orders', []), data.get('items', [])
    mode = data.get('mode', 'upsert')
    if not spreadsheet_id: return jsonify({"success": False, "message": "Spreadsheet ID is required"}), 400
    try:
        service = get_sheets_service()
        customer_headers = ['ID', 'Shop Name', 'Address', 'Phone', 'City', 'Discount 1', 'Discount 2', 'Balance', 'Credit Period', 'Status', 'Last Updated']
        inventory_headers = ['ID', 'Display Name', 'Internal Name', 'SKU', 'Vehicle', 'Brand/Origin', 'Category', 'Unit Value', 'Stock Qty', 'Low Stock Threshold', 'Out of Stock', 'Status', 'Last Updated']
        order_headers = ['Order ID', 'Customer ID', 'Rep ID', 'Date', 'Gross Total', 'Disc 1 Rate', 'Disc 1 Value', 'Disc 2 Rate', 'Disc 2 Value', 'Net Total', 'Paid', 'Balance Due', 'Payment Status', 'Delivery Status', 'Credit Period', 'Status', 'Last Updated']
        line_headers = ['Line ID', 'Order ID', 'Item ID', 'Item Name', 'Qty', 'Unit Price', 'Line Total']

        ensure_headers(service, spreadsheet_id, 'Customers', customer_headers)
        ensure_headers(service, spreadsheet_id, 'Inventory', inventory_headers)
        ensure_headers(service, spreadsheet_id, 'Orders', order_headers)
        ensure_headers(service, spreadsheet_id, 'OrderLines', line_headers)
        
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

        if items:
            values = [[i['item_id'], i['item_display_name'], i['item_name'], i['item_number'], i['vehicle_model'], i['source_brand'], i.get('category', 'Uncategorized'), i['unit_value'], i['current_stock_qty'], i.get('low_stock_threshold', 10), i.get('is_out_of_stock', False), i['status'], i['updated_at']] for i in items]
            if mode == 'overwrite':
                service.spreadsheets().values().update(spreadsheetId=spreadsheet_id, range="'Inventory'!A1", valueInputOption="RAW", body={"values": [inventory_headers]}).execute()
                service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range="'Inventory'!A2:Z").execute()
                service.spreadsheets().values().append(spreadsheetId=spreadsheet_id, range="'Inventory'!A2", valueInputOption="USER_ENTERED", body={"values": values}).execute()
            else: upsert_rows(service, spreadsheet_id, 'Inventory', inventory_headers, values, 0)
        else:
            upsert_rows(service, spreadsheet_id, 'Inventory', inventory_headers, [], 0)

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
                for l in o.get('lines', []): line_values.append([l['line_id'], o['order_id'], l['item_id'], l['item_name'], l['quantity'], l['unit_value'], l['line_total']])
            if line_values: upsert_rows(service, spreadsheet_id, 'OrderLines', line_headers, line_values, 0)
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
                pulled_items.append({
                    "item_id": str(row[0]), "item_display_name": str(row[1]), "item_name": str(row[2] or row[1]),
                    "item_number": str(row[3]), "vehicle_model": str(row[4]), "source_brand": str(row[5] or 'Unknown'),
                    "category": str(row[6] or 'Uncategorized'), "unit_value": float(row[7]) if row[7] else 0, "current_stock_qty": int(row[8]) if row[8] else 0,
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
                pulled_customers.append({
                    "customer_id": str(row[0]), "shop_name": str(row[1]), "address": str(row[2]),
                    "phone": str(row[3]), "city_ref": str(row[4]), 
                    "discount_rate": float(row[5]) if row[5] else 0, "secondary_discount_rate": float(row[6]) if row[6] else 0,
                    "outstanding_balance": float(row[7]) if row[7] else 0, "credit_period": int(row[8]) if row[8] else 90,
                    "status": str(row[9] or 'active'), "updated_at": str(row[10] or ''), "sync_status": 'synced'
                })

        # 3. Pull Orders
        result_orders = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'Orders'!A:Z").execute()
        result_lines = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range="'OrderLines'!A:Z").execute()
        pulled_orders = []
        order_rows = result_orders.get('values', [])
        line_rows = result_lines.get('values', [])
        
        lines_by_order = {}
        if len(line_rows) > 1:
            for row in line_rows[1:]:
                if len(row) < 7: continue
                oid = str(row[1])
                line = {"line_id": str(row[0]), "order_id": oid, "item_id": str(row[2]), "item_name": str(row[3]), "quantity": int(row[4]) if row[4] else 0, "unit_value": float(row[5]) if row[5] else 0, "line_total": float(row[6]) if row[6] else 0}
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
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
