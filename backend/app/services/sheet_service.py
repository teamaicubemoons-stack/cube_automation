import os
import asyncio
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv(override=True)

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service_account.json")
SPREADSHEET_ID = os.getenv("GOOGLE_SHEET_ID")

def get_sheets_service():
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"{SERVICE_ACCOUNT_FILE} not found. Please follow the setup guide.")
    
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    print(f"DEBUG: Using Service Account: {creds.service_account_email}")
    service = build('sheets', 'v4', credentials=creds)
    return service.spreadsheets()

async def _execute(request):
    return await asyncio.to_thread(request.execute)

async def read_sheet_data(spreadsheet_id: str):
    """Reads all data from the spreadsheet."""
    service = get_sheets_service()
    
    # Get first sheet name dynamically
    spreadsheet = await _execute(service.get(spreadsheetId=spreadsheet_id))
    sheet_name = spreadsheet.get('sheets', [])[0].get('properties', {}).get('title', 'Sheet1')
    
    result = await _execute(service.values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A:Z"
    ))
    return result.get('values', [])

async def update_row_status(spreadsheet_id: str, row_index: int, status: str, reason: str = ""):
    """Updates the status and reason columns for a specific row dynamically based on headers."""
    service = get_sheets_service()
    
    spreadsheet = await _execute(service.get(spreadsheetId=spreadsheet_id))
    sheet_name = spreadsheet.get('sheets', [])[0].get('properties', {}).get('title', 'Sheet1')
    
    # Read headers to find Status and Reason columns
    result = await _execute(service.values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A1:Z1"
    ))
    headers = result.get('values', [])
    headers = headers[0] if headers else []
    
    # Try to find Status and Reason in headers, default to G and H (index 6, 7) if not found
    try:
        status_idx = headers.index("Status")
    except ValueError:
        status_idx = 6
    try:
        reason_idx = headers.index("Reason")
    except ValueError:
        reason_idx = 7
        
    def col_num_to_letter(col_num: int) -> str:
        letter = ""
        col_num += 1
        while col_num > 0:
            col_num, remainder = divmod(col_num - 1, 26)
            letter = chr(65 + remainder) + letter
        return letter
        
    status_col = col_num_to_letter(status_idx)
    reason_col = col_num_to_letter(reason_idx)
    
    # Batch update the row's status and reason cells
    if status_idx < reason_idx:
        range_name = f"{sheet_name}!{status_col}{row_index+1}:{reason_col}{row_index+1}"
        values = [[status, reason]]
    else:
        range_name = f"{sheet_name}!{reason_col}{row_index+1}:{status_col}{row_index+1}"
        values = [[reason, status]]
        
    body = {'values': values}
    
    await _execute(service.values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="RAW",
        body=body
    ))

async def ensure_headers(spreadsheet_id: str):
    """Checks if 'Status' and 'Reason' headers exist, adds them if not, and expands grid."""
    service = get_sheets_service()
    
    # Get metadata
    spreadsheet = await _execute(service.get(spreadsheetId=spreadsheet_id))
    sheet = spreadsheet.get('sheets', [])[0]
    sheet_id = sheet.get('properties', {}).get('sheetId', 0)
    sheet_name = sheet.get('properties', {}).get('title', 'Sheet1')
    current_cols = sheet.get('gridProperties', {}).get('columnCount', 0)
    
    # Read headers
    values = await read_sheet_data(spreadsheet_id)
    headers = values[0] if values else []
    
    # If columns G (7) and H (8) don't exist in grid, add them
    if current_cols < 8:
        print(f"DEBUG: Expanding sheet columns from {current_cols} to 8...")
        await _execute(service.batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "requests": [{
                    "appendDimension": {
                        "sheetId": sheet_id,
                        "dimension": "COLUMNS",
                        "length": 8 - current_cols
                    }
                }]
            }
        ))

    if "Status" not in headers:
        print("DEBUG: Adding 'Status' and 'Reason' headers...")
        new_headers = headers + ["Status", "Reason"]
        await _execute(service.values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A1",
            valueInputOption="RAW",
            body={'values': [new_headers]}
        ))

async def get_next_campaign_id(spreadsheet_id: str) -> str:
    """Reads the first column of Logs Data sheet to calculate the next CAM### ID."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    try:
        result = await _execute(service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:A"
        ))
        values = result.get('values', [])
    except Exception as e:
        print(f"DEBUG: Error reading Logs Data sheet for Campaign ID: {e}")
        values = []
    
    # Exclude header row if present
    campaign_ids = [row[0] for row in values if row and row[0].startswith("CAM")]
    
    if not campaign_ids:
        return "CAM001"
    
    # Find the last campaign ID
    last_id = campaign_ids[-1]
    import re
    match = re.match(r"CAM(\d+)", last_id)
    if match:
        try:
            num = int(match.group(1))
            next_num = num + 1
        except ValueError:
            next_num = len(campaign_ids) + 1
    else:
        next_num = len(campaign_ids) + 1
        
    return f"CAM{next_num:03d}"

async def ensure_logs_sheet_headers(spreadsheet_id: str):
    """Ensures headers are present in the Logs Data sheet (12-column layout)."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    try:
        service = get_sheets_service()
        
        # Get sheet metadata and titles
        spreadsheet = await _execute(service.get(spreadsheetId=spreadsheet_id))
        sheets = spreadsheet.get('sheets', [])
        sheet_titles = [s.get('properties', {}).get('title') for s in sheets]
        
        # Create 'Logs Data' sheet if it doesn't exist
        if "Logs Data" not in sheet_titles:
            print("DEBUG: 'Logs Data' sheet tab not found. Creating it...")
            await _execute(service.batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={
                    "requests": [{
                        "addSheet": {
                            "properties": {
                                "title": "Logs Data"
                            }
                        }
                    }]
                }
            ))
            print("DEBUG: 'Logs Data' sheet tab created successfully.")
            
        try:
            result = await _execute(service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A1:L1"
            ))
            headers = result.get('values', [])
        except Exception:
            headers = []
            
        # 12-column layout:
        # A: Campaign ID, B: Platform, C: Recipient Name, D: Company Name,
        # E: WhatsApp Number, F: Email, G: Timestamp, H: Details, I: Generate By,
        # J: Subscription (Yes / No), K: Unsubscribe Reason, L: If Other (Reason)
        expected_headers = [
            "Campaign ID", "Platform", "Recipient Name", "Company Name",
            "WhatsApp Number", "Email", "Timestamp", "Details", "Generate By",
            "Subscription (Yes / No)", "Unsubscribe Reason", "If Other (Reason)"
        ]
        
        if not headers or not headers[0]:
            print("DEBUG: Creating headers in Logs Data sheet...")
            await _execute(service.values().update(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A1:L1",
                valueInputOption="RAW",
                body={'values': [expected_headers]}
            ))
        elif len(headers[0]) < 12:
            # Extend existing headers with new columns if they don't exist
            existing = headers[0]
            new_cols = []
            for col in expected_headers[len(existing):]:
                new_cols.append(col)
            if new_cols:
                col_letter_start = chr(ord('A') + len(existing))
                col_letter_end = chr(ord('A') + len(expected_headers) - 1)
                print(f"DEBUG: Extending Logs Data headers with new columns: {new_cols}")
                await _execute(service.values().update(
                    spreadsheetId=spreadsheet_id,
                    range=f"Logs Data!{col_letter_start}1:{col_letter_end}1",
                    valueInputOption="RAW",
                    body={'values': [new_cols]}
                ))
    except Exception as e:
        print(f"DEBUG: Logs sheet is inaccessible: {e}")

async def append_campaign_log(
    spreadsheet_id: str,
    campaign_id: str,
    platform: str,
    name: str,
    phone: str,
    email: str,
    status: str,
    details: str,
    generated_by: str = "",
    company_name: str = ""
):
    """Appends a campaign log entry to the Logs Data sheet (12-column layout)."""
    from datetime import datetime
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    # Format: "27 June 2026, 03:23PM"  (cross-platform: strip leading zero from day)
    _now = datetime.now()
    timestamp = f"{_now.day} {_now.strftime('%B %Y, %I:%M%p')}"
    
    log_details = f"{status}: {details}" if details else status
    # 12 columns: Campaign ID, Platform, Recipient Name, Company Name, WhatsApp Number,
    # Email, Timestamp, Details, Generate By, Subscription (Yes/No), Unsubscribe Reason, If Other (Reason)
    row_data = [
        campaign_id, platform, name, company_name or "",
        phone or "", email or "", timestamp, log_details, generated_by,
        "Yes", "", ""   # Default subscription = Yes (not yet unsubscribed)
    ]
    
    try:
        await _execute(service.values().append(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:L",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row_data]}
        ))
        print(f"DEBUG: Appended log row for {name} ({platform}) to Logs Data sheet")
    except Exception as e:
        print(f"DEBUG: Failed to append campaign log to Logs Data sheet: {e}")

async def update_log_status(spreadsheet_id: str, campaign_id: str, email: str, status: str, details: str):
    """Updates the details column for a specific campaign ID and email in Logs Data."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    try:
        result = await _execute(service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:F"
        ))
        rows = result.get('values', [])
    except Exception as e:
        print(f"DEBUG: Error reading Logs Data sheet for status update: {e}")
        return
    
    for idx, row in enumerate(rows):
        if idx == 0:
            continue
        if len(row) >= 6:
            row_campaign_id = row[0]
            row_platform = row[1]
            row_email = row[5]  # Column F is now email (index 5) after Company Name shift
            
            if row_campaign_id == campaign_id and row_platform == "Email" and row_email == email:
                row_num = idx + 1
                # Column H is index 7 (Details column)
                range_name = f"Logs Data!H{row_num}"
                body = {'values': [[details]]}
                await _execute(service.values().update(
                    spreadsheetId=spreadsheet_id,
                    range=range_name,
                    valueInputOption="RAW",
                    body=body
                ))
                print(f"DEBUG: Updated Logs Data sheet row {row_num} status to {status}")
                break

async def update_unsubscribe_status(
    spreadsheet_id: str,
    email: str,
    campaign_id: str,
    reason: str,
    other_reason: str = ""
):
    """
    Updates the Unsubscribe columns (J, K, L) in Logs Data sheet for a given email+campaign.
    J = Subscription (Yes / No) → set to "No"
    K = Unsubscribe Reason → reason text
    L = If Other (Reason) → other_reason if reason is Others
    """
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    try:
        result = await _execute(service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:F"
        ))
        rows = result.get('values', [])
    except Exception as e:
        print(f"DEBUG: Error reading Logs Data sheet for unsubscribe update: {e}")
        return False

    updated = False
    for idx, row in enumerate(rows):
        if idx == 0:
            continue  # Skip header
        if len(row) >= 6:
            row_campaign_id = row[0]
            row_platform = row[1]
            row_email = row[5]  # Column F = Email

            # Match on email; optionally also campaign_id if provided
            email_match = row_email == email
            campaign_match = (not campaign_id) or (row_campaign_id == campaign_id)

            if email_match and campaign_match and row_platform == "Email":
                row_num = idx + 1
                # Columns J, K, L = indices 9, 10, 11 → letters J, K, L
                range_name = f"Logs Data!J{row_num}:L{row_num}"
                body = {'values': [["No", reason, other_reason]]}
                await _execute(service.values().update(
                    spreadsheetId=spreadsheet_id,
                    range=range_name,
                    valueInputOption="RAW",
                    body=body
                ))
                print(f"DEBUG: Updated unsubscribe status for {email} at row {row_num}")
                updated = True
                # Don't break — update all rows for this email/campaign (multiple sends possible)

    return updated

async def read_users_data(spreadsheet_id: str = None) -> list:
    """Reads all data from the Users sheet tab. If empty, populates a default admin user."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    if not spreadsheet_id:
        return []
    service = get_sheets_service()
    
    # 1. First, make sure the Users sheet tab exists
    try:
        spreadsheet = await _execute(service.get(spreadsheetId=spreadsheet_id))
        sheets = spreadsheet.get('sheets', [])
        sheet_titles = [s.get('properties', {}).get('title') for s in sheets]
        if "Users" not in sheet_titles:
            print("DEBUG: 'Users' sheet tab not found. Creating it...")
            await _execute(service.batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={
                    "requests": [{
                        "addSheet": {
                            "properties": {
                                "title": "Users"
                            }
                        }
                    }]
                }
            ))
            # Set headers
            expected_headers = ["ID", "User Name", "Password", "Role"]
            await _execute(service.values().update(
                spreadsheetId=spreadsheet_id,
                range="Users!A1:D1",
                valueInputOption="RAW",
                body={'values': [expected_headers]}
            ))
    except Exception as e:
        print(f"DEBUG: Failed to verify/create Users sheet tab: {e}")
        
    try:
        result = await _execute(service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Users!A:D"
        ))
        values = result.get('values', [])
        
        # If no users or only header exists, add a default admin user
        if not values or len(values) <= 1:
            print("DEBUG: Users sheet is empty. Appending default user 'Admin'/'admin123'...")
            default_headers = ["ID", "User Name", "Password", "Role"]
            default_user = ["CUB001", "Admin", "admin123", "Admin"]
            
            # If values is completely empty, write headers first
            if not values:
                await _execute(service.values().update(
                    spreadsheetId=spreadsheet_id,
                    range="Users!A1:D1",
                    valueInputOption="RAW",
                    body={'values': [default_headers]}
                ))
                
            await _execute(service.values().append(
                spreadsheetId=spreadsheet_id,
                range="Users!A:D",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={"values": [default_user]}
            ))
            
            # Re-read to get updated values
            result = await _execute(service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Users!A:D"
            ))
            values = result.get('values', [])
            
        return values
    except Exception as e:
        print(f"DEBUG: Error reading Users sheet: {e}")
        return []
