import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

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
    """Updates the status and reason columns for a specific row."""
    service = get_sheets_service()
    
    spreadsheet = service.get(spreadsheetId=spreadsheet_id).execute()
    sheet_name = spreadsheet.get('sheets', [])[0].get('properties', {}).get('title', 'Sheet1')
    
    # We assume columns 'Status' and 'Reason' are at the end (e.g., column G and H)
    range_name = f"{sheet_name}!G{row_index+1}:H{row_index+1}"
    values = [[status, reason]]
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

