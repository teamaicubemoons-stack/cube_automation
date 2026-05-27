from fastapi import APIRouter, UploadFile, File, Form
import pandas as pd
import io
import json
from app.services.ai_service import detect_columns, rewrite_message
from app.services.sheet_service import read_sheet_data, ensure_headers, update_row_status


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

async def run_campaign_task(campaign_id, platform, spreadsheet_id, rows, headers, mapping_dict, whatsapp_message, email_subject, email_body):
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
                campaign_manager[campaign_id].append({"name": name, "phone": clean_phone, "type": "WhatsApp", "status": result['status'], "reason": result.get('reason', '')})
                
                if result['status'] == "Sent":
                    print(f"   WhatsApp: {result['status']}")
                else:
                    print(f"   WhatsApp Failed: {result.get('reason', 'Unknown reason')}")
                
                # Then update Google Sheet
                await update_row_status(spreadsheet_id, row_index, result['status'], result.get('reason', ''))
            except Exception as e:
                print(f"   WhatsApp Error: {e}")

        # Email
        if platform in ["email", "both"] and email_idx != -1 and email_idx < len(row):
            email = row[email_idx]
            body = (email_body or "").replace("{name}", name)
            try:
                result = await send_email(email, email_subject or "Update", body)
                # Update memory log first
                campaign_manager[campaign_id].append({"name": name, "email": email, "type": "Email", "status": result['status'], "reason": result.get('reason', '')})
                print(f"   Email: {result['status']}")
                
                # Then update Google Sheet
                await update_row_status(spreadsheet_id, row_index, result['status'], result.get('reason', ''))
            except Exception as e:
                print(f"   Email Error: {e}")

        await asyncio.sleep(2)
    print(f"\n[CAMPAIGN FINISHED] ID: {campaign_id}\n")

@router.post("/start-campaign")
async def start_campaign(
    background_tasks: BackgroundTasks,
    platform: str = Form(...),
    spreadsheet_id: str = Form(...),
    whatsapp_message: str = Form(None),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    mapping: str = Form(...)
):
    mapping_dict = json.loads(mapping)
    data = await read_sheet_data(spreadsheet_id)
    if not data:
        return {"error": "No data found in Google Sheet"}
    
    await ensure_headers(spreadsheet_id)
    
    headers = data[0]
    rows = data[1:]
    
    campaign_id = str(uuid.uuid4())
    campaign_manager[campaign_id] = []
    
    print(f"DEBUG: Queueing campaign task for {len(rows)} contacts...")
    background_tasks.add_task(
        run_campaign_task, 
        campaign_id, platform, spreadsheet_id, rows, headers, mapping_dict, whatsapp_message, email_subject, email_body
    )
    
    return {
        "message": "Campaign started successfully", 
        "campaign_id": campaign_id, 
        "total_contacts": len(rows)
    }


@router.get("/campaign/{campaign_id}/status")
async def get_campaign_status(campaign_id: str):
    return campaign_manager.get(campaign_id, [])



@router.post("/rewrite")
async def ai_rewrite(message: str = Form(...), tone: str = Form("professional")):
    rewritten = await rewrite_message(message, tone)
    return {"rewritten": rewritten}
