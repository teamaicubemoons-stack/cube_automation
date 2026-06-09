import os
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

async def read_sheet_data(spreadsheet_id: str):
    """Reads all data from the spreadsheet."""
    service = get_sheets_service()
    
    # Get first sheet name dynamically
    spreadsheet = service.get(spreadsheetId=spreadsheet_id).execute()
    sheet_name = spreadsheet.get('sheets', [])[0].get('properties', {}).get('title', 'Sheet1')
    
    result = service.values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A:Z"
    ).execute()
    return result.get('values', [])

async def update_row_status(spreadsheet_id: str, row_index: int, status: str, reason: str = ""):
    """Updates the status and reason columns for a specific row dynamically based on headers."""
    service = get_sheets_service()
    
    spreadsheet = service.get(spreadsheetId=spreadsheet_id).execute()
    sheet_name = spreadsheet.get('sheets', [])[0].get('properties', {}).get('title', 'Sheet1')
    
    # Read headers to find Status and Reason columns
    result = service.values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!A1:Z1"
    ).execute()
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
    
    service.values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="RAW",
        body=body
    ).execute()

async def ensure_headers(spreadsheet_id: str):
    """Checks if 'Status' and 'Reason' headers exist, adds them if not, and expands grid."""
    service = get_sheets_service()
    
    # Get metadata
    spreadsheet = service.get(spreadsheetId=spreadsheet_id).execute()
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
        service.batchUpdate(
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
        ).execute()

    if "Status" not in headers:
        print("DEBUG: Adding 'Status' and 'Reason' headers...")
        new_headers = headers + ["Status", "Reason"]
        service.values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{sheet_name}!A1",
            valueInputOption="RAW",
            body={'values': [new_headers]}
        ).execute()



async def get_next_campaign_id(spreadsheet_id: str) -> str:
    """Reads the first column of Logs Data sheet to calculate the next CAM### ID."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    try:
        result = service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:A"
        ).execute()
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
    try:
        num = int(last_id.replace("CAM", ""))
        next_num = num + 1
    except ValueError:
        next_num = len(campaign_ids) + 1
        
    return f"CAM{next_num:03d}"

async def ensure_logs_sheet_headers(spreadsheet_id: str):
    """Ensures headers are present in the Logs Data sheet (7-column layout)."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    try:
        service = get_sheets_service()
        
        # Get sheet metadata and titles
        spreadsheet = service.get(spreadsheetId=spreadsheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        sheet_titles = [s.get('properties', {}).get('title') for s in sheets]
        
        # Create 'Logs Data' sheet if it doesn't exist
        if "Logs Data" not in sheet_titles:
            print("DEBUG: 'Logs Data' sheet tab not found. Creating it...")
            service.batchUpdate(
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
            ).execute()
            print("DEBUG: 'Logs Data' sheet tab created successfully.")
            
        try:
            result = service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A1:G1"
            ).execute()
            headers = result.get('values', [])
        except Exception:
            headers = []
            
        expected_headers = ["Campaign ID", "Platform", "Recipient Name", "WhatsApp Number", "Email", "Timestamp", "Details"]
        
        if not headers or not headers[0]:
            print("DEBUG: Creating headers in Logs Data sheet...")
            service.values().update(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A1:G1",
                valueInputOption="RAW",
                body={'values': [expected_headers]}
            ).execute()
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
    details: str
):
    """Appends a campaign log entry to the Logs Data sheet (7-column layout)."""
    from datetime import datetime
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    timestamp = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
    
    log_details = f"{status}: {details}" if details else status
    row_data = [campaign_id, platform, name, phone or "", email or "", timestamp, log_details]
    
    try:
        service.values().append(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:G",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row_data]}
        ).execute()
        print(f"DEBUG: Appended log row for {name} ({platform}) to Logs Data sheet")
    except Exception as e:
        print(f"DEBUG: Failed to append campaign log to Logs Data sheet: {e}")

async def update_log_status(spreadsheet_id: str, campaign_id: str, email: str, status: str, details: str):
    """Updates the details column for a specific campaign ID and email in Logs Data (7-column layout)."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    service = get_sheets_service()
    try:
        result = service.values().get(
            spreadsheetId=spreadsheet_id,
            range="Logs Data!A:E"
        ).execute()
        rows = result.get('values', [])
    except Exception as e:
        print(f"DEBUG: Error reading Logs Data sheet for status update: {e}")
        return
    
    for idx, row in enumerate(rows):
        if idx == 0:
            continue
        if len(row) >= 5:
            row_campaign_id = row[0]
            row_platform = row[1]
            row_email = row[4]
            
            if row_campaign_id == campaign_id and row_platform == "Email" and row_email == email:
                row_num = idx + 1
                # Column G is index 6 (Details column)
                range_name = f"Logs Data!G{row_num}"
                body = {'values': [[details]]}
                service.values().update(
                    spreadsheetId=spreadsheet_id,
                    range=range_name,
                    valueInputOption="RAW",
                    body=body
                ).execute()
                print(f"DEBUG: Updated Logs Data sheet row {row_num} status to {status}")
                break
