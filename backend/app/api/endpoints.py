import os
from fastapi import APIRouter, UploadFile, File, Form, Request, Response, HTTPException
import pandas as pd
import io
import json
from app.services.ai_service import detect_columns, rewrite_message
from app.services.sheet_service import (
    read_sheet_data, 
    get_next_campaign_id,
    ensure_logs_sheet_headers,
    append_campaign_log,
    update_log_status
)


router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a file, uses AI to detect columns, and returns a preview.
    """
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))
    
    columns = df.columns.tolist()
    sample_data = df.head(3).to_dict(orient='records')
    
    # Detect columns using AI
    detected = await detect_columns(columns, sample_data)
    
    return {
        "filename": file.filename,
        "columns": columns,
        "sample_data": sample_data,
        "detected_mapping": detected
    }

import uuid
import asyncio
from fastapi import BackgroundTasks

# In-memory storage for campaign results (Replacement for Redis)
campaign_manager = {}

from app.services.whatsapp_service import send_whatsapp_message
from app.services.email_service import send_email

async def run_campaign_task(campaign_id, platform, spreadsheet_id, rows, headers, mapping_dict, whatsapp_message, email_subject, email_body, base_url):
    print(f"\n{'='*40}")
    print(f"[CAMPAIGN START] ID: {campaign_id}")
    print(f"Total Rows: {len(rows)} | Platform: {platform}")
    print(f"{'='*40}")

    def get_idx(key, default_name):
        idx = headers.index(mapping_dict[key]) if mapping_dict.get(key) in headers else -1
        if idx == -1:
            for i, h in enumerate(headers):
                if h.lower() == default_name.lower(): return i
        return idx

    phone_idx = get_idx('phone', 'Phone')
    email_idx = get_idx('email', 'Email')
    name_idx = get_idx('name', 'Name')

    for i, row in enumerate(rows):
        row_index = i + 1
        name = row[name_idx] if (name_idx != -1 and name_idx < len(row)) else "Customer"
        print(f"-> [{i+1}/{len(rows)}] Processing: {name}")

        # WhatsApp
        if platform in ["whatsapp", "both"] and phone_idx != -1 and phone_idx < len(row):
            phone = str(row[phone_idx])
            clean_phone = phone.strip().replace(" ", "").replace("-", "").strip("+")
            if len(clean_phone) == 10: clean_phone = "91" + clean_phone
            
            msg = (whatsapp_message or "").replace("{name}", name)
            try:
                result = await send_whatsapp_message(clean_phone, msg)
                # Update memory log first
                campaign_manager[campaign_id]["results"].append({
                    "name": name, 
                    "phone": clean_phone, 
                    "type": "WhatsApp", 
                    "status": result['status'], 
                    "reason": result.get('reason', ''),
                    "row_index": row_index
                })
                
                if result['status'] == "Sent":
                    print(f"   WhatsApp: {result['status']}")
                else:
                    print(f"   WhatsApp Failed: {result.get('reason', 'Unknown reason')}")
                
                # Append to Logs Data sheet
                await append_campaign_log(
                    spreadsheet_id=spreadsheet_id,
                    campaign_id=campaign_id,
                    platform="WhatsApp",
                    name=name,
                    phone=clean_phone,
                    email="",
                    status=result['status'],
                    details=result.get('reason', '')
                )
            except Exception as e:
                print(f"   WhatsApp Error: {e}")

        # Email
        if platform in ["email", "both"] and email_idx != -1 and email_idx < len(row):
            email = row[email_idx]
            body = (email_body or "").replace("{name}", name)
            tracking_url = f"{base_url}api/campaign/track-open?campaign_id={campaign_id}&email={email}"
            try:
                result = await send_email(email, email_subject or "Update", body, tracking_url=tracking_url)
                # Update memory log first
                campaign_manager[campaign_id]["results"].append({
                    "name": name, 
                    "email": email, 
                    "type": "Email", 
                    "status": result['status'], 
                    "reason": result.get('reason', ''),
                    "row_index": row_index
                })
                print(f"   Email: {result['status']}")
                
                # Append to Logs Data sheet
                await append_campaign_log(
                    spreadsheet_id=spreadsheet_id,
                    campaign_id=campaign_id,
                    platform="Email",
                    name=name,
                    phone="",
                    email=email,
                    status=result['status'],
                    details=result.get('reason', '')
                )
            except Exception as e:
                print(f"   Email Error: {e}")

        await asyncio.sleep(2)
    print(f"\n[CAMPAIGN FINISHED] ID: {campaign_id}\n")

@router.post("/start-campaign")
async def start_campaign(
    background_tasks: BackgroundTasks,
    request: Request,
    platform: str = Form(...),
    spreadsheet_id: str = Form(...),
    whatsapp_message: str = Form(None),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    mapping: str = Form(...)
):
    mapping_dict = json.loads(mapping)
    try:
        data = await read_sheet_data(spreadsheet_id)
    except Exception as e:
        print(f"DEBUG: Error reading spreadsheet data: {e}")
        raise HTTPException(
            status_code=400,
            detail="Failed to read Google Sheet. Please share it with the service account (audit-ai@recruiterai-492605.iam.gserviceaccount.com) as at least a Viewer."
        )
        
    if not data:
        raise HTTPException(
            status_code=400,
            detail="No data found in Google Sheet."
        )
    
    await ensure_logs_sheet_headers(spreadsheet_id)
    
    headers = data[0]
    rows = data[1:]
    
    campaign_id = await get_next_campaign_id(spreadsheet_id)
    campaign_manager[campaign_id] = {
        "metadata": {
            "spreadsheet_id": spreadsheet_id,
            "platform": platform
        },
        "results": []
    }
    
    base_url = os.getenv("BACKEND_URL") or str(request.base_url)
    if not base_url.endswith("/"):
        base_url += "/"
    print(f"DEBUG: Queueing campaign task for {len(rows)} contacts...")
    background_tasks.add_task(
        run_campaign_task, 
        campaign_id, platform, spreadsheet_id, rows, headers, mapping_dict, whatsapp_message, email_subject, email_body, base_url
    )
    
    return {
        "message": "Campaign started successfully", 
        "campaign_id": campaign_id, 
        "total_contacts": len(rows)
    }


@router.get("/campaigns")
async def list_campaigns(spreadsheet_id: str = None):
    """Returns a sorted list of unique campaign IDs."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    campaigns = set(campaign_manager.keys())
    if spreadsheet_id:
        try:
            from app.services.sheet_service import get_sheets_service
            service = get_sheets_service()
            result = service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A:A"
            ).execute()
            values = result.get('values', [])
            for row in values:
                if row and row[0].startswith("CAM"):
                    campaigns.add(row[0])
        except Exception:
            print("DEBUG: Logs sheet is inaccessible for listing campaigns (check permissions).")
            
    return sorted(list(campaigns), reverse=True)


@router.get("/campaign/all/status")
async def get_all_campaigns_status(spreadsheet_id: str = None):
    """Returns log entries from all active and historical campaigns combined."""
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    all_results = []
    loaded_campaigns = set()
    for campaign_id, campaign in campaign_manager.items():
        all_results.extend(campaign.get("results", []))
        loaded_campaigns.add(campaign_id)
        
    if spreadsheet_id:
        try:
            from app.services.sheet_service import get_sheets_service
            service = get_sheets_service()
            result = service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A:G"
            ).execute()
            rows = result.get('values', [])
            
            for row in rows:
                if len(row) >= 7 and row[0].startswith("CAM"):
                    if row[0] not in loaded_campaigns:
                        details_val = row[6] if len(row) > 6 else ""
                        status_val = "Sent"
                        if "Seen" in details_val:
                            status_val = "Seen"
                        elif "Failed" in details_val:
                            status_val = "Failed"
                            
                        all_results.append({
                            "name": row[2],
                            "phone": row[3] if row[1] == "WhatsApp" else None,
                            "email": row[4] if row[1] == "Email" else None,
                            "type": row[1],
                            "status": status_val,
                            "reason": details_val
                        })
        except Exception:
            print("DEBUG: Logs sheet is inaccessible for all campaign status polling (check permissions).")
            
    return all_results


@router.get("/campaign/{campaign_id}/status")
async def get_campaign_status(campaign_id: str, spreadsheet_id: str = None):
    """Returns log entries for a specific campaign ID, falling back to Google Sheets."""
    if campaign_id in campaign_manager:
        return campaign_manager[campaign_id].get("results", [])
        
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    if spreadsheet_id:
        try:
            from app.services.sheet_service import get_sheets_service
            service = get_sheets_service()
            result = service.values().get(
                spreadsheetId=spreadsheet_id,
                range="Logs Data!A:G"
            ).execute()
            rows = result.get('values', [])
            
            results = []
            for row in rows:
                if len(row) >= 7 and row[0] == campaign_id:
                    details_val = row[6] if len(row) > 6 else ""
                    status_val = "Sent"
                    if "Seen" in details_val:
                        status_val = "Seen"
                    elif "Failed" in details_val:
                        status_val = "Failed"
                        
                    results.append({
                        "name": row[2],
                        "phone": row[3] if row[1] == "WhatsApp" else None,
                        "email": row[4] if row[1] == "Email" else None,
                        "type": row[1],
                        "status": status_val,
                        "reason": details_val
                    })
            return results
        except Exception:
            print(f"DEBUG: Logs sheet is inaccessible for campaign status lookup: {campaign_id} (check permissions).")
            
    return []


@router.get("/campaign/track-open")
async def track_open(campaign_id: str, email: str):
    from datetime import datetime
    print(f"DEBUG: Track open received for campaign {campaign_id}, email {email}")
    
    opened_time = datetime.now().strftime("%I:%M %p")
    details = f"Seen at {opened_time}"
    
    # 1. Update in-memory if available
    spreadsheet_id = None
    if campaign_id in campaign_manager:
        campaign = campaign_manager[campaign_id]
        spreadsheet_id = campaign.get("metadata", {}).get("spreadsheet_id")
        for item in campaign.get("results", []):
            if item.get("email") == email and item.get("status") != "Seen":
                item["status"] = "Seen"
                item["reason"] = details
                break
                
    # 2. Always fall back or default to LOGS_SPREADSHEET_ID from env
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    
    # 3. Always update Google Sheets directly if spreadsheet_id is resolved
    if spreadsheet_id:
        try:
            print(f"DEBUG: Enqueueing Google Sheets log update to 'Seen' for campaign {campaign_id}, email {email}")
            asyncio.create_task(update_log_status(spreadsheet_id, campaign_id, email, "Seen", details))
        except Exception as e:
            print(f"DEBUG: Failed to update Logs Data sheet on open tracking: {e}")

    gif_bytes = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
    return Response(
        content=gif_bytes,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )



@router.post("/rewrite")
async def ai_rewrite(message: str = Form(...), tone: str = Form("professional")):
    rewritten = await rewrite_message(message, tone)
    return {"rewritten": rewritten}
