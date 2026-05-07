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
    service = build('sheets', 'v4', credentials=creds)
    return service.spreadsheets()

async def read_sheet_data():
    """Reads all data from the spreadsheet."""
    service = get_sheets_service()
    result = service.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Sheet1!A:Z"
    ).execute()
    return result.get('values', [])

async def update_row_status(row_index: int, status: str, reason: str = ""):
    """Updates the status and reason columns for a specific row."""
    service = get_sheets_service()
    
    # We assume columns 'Status' and 'Reason' are at the end (e.g., column G and H)
    # Row index starts from 1 in Google Sheets (A1 is row 1)
    # If our data has 6 columns (A-F), we update G and H
    range_name = f"Sheet1!G{row_index+1}:H{row_index+1}"
    values = [[status, reason]]
    body = {'values': values}
    
    service.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=range_name,
        valueInputOption="RAW",
        body=body
    ).execute()

async def ensure_headers():
    """Checks if 'Status' and 'Reason' headers exist, adds them if not."""
    values = await read_sheet_data()
    if not values:
        return
    
    headers = values[0]
    if "Status" not in headers:
        service = get_sheets_service()
        new_headers = headers + ["Status", "Reason"]
        service.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="Sheet1!A1",
            valueInputOption="RAW",
            body={'values': [new_headers]}
        ).execute()
