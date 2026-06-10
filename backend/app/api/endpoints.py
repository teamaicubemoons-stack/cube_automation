import os
from datetime import datetime
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
                    "row_index": row_index,
                    "sent_time": datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
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
                    "row_index": row_index,
                    "sent_time": datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
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
    spreadsheet_id: str = Form(None),
    whatsapp_message: str = Form(None),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    mapping: str = Form(...),
    start_sno: str = Form(None),
    end_sno: str = Form(None),
    file: UploadFile = File(None)
):
    mapping_dict = json.loads(mapping)
    
    if file is not None:
        try:
            contents = await file.read()
            if file.filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(contents))
            else:
                df = pd.read_excel(io.BytesIO(contents))
            
            df = df.fillna("")
            headers = df.columns.tolist()
            rows = []
            for r in df.values.tolist():
                rows.append([str(x) if x is not None and str(x) != 'nan' else "" for x in r])
        except Exception as e:
            print(f"DEBUG: Error reading uploaded file: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to process uploaded file: {str(e)}"
            )
    else:
        if not spreadsheet_id:
            raise HTTPException(
                status_code=400,
                detail="Please provide a Google Sheet ID or upload a local file."
            )
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
        
        headers = data[0]
        rows = data[1:]
    
    await ensure_logs_sheet_headers(spreadsheet_id)
    
    # Parse S NO inputs
    start_sno_int = None
    end_sno_int = None
    if start_sno and start_sno.strip():
        try:
            start_sno_int = int(float(start_sno.strip()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Start S.No must be a valid integer.")
    if end_sno and end_sno.strip():
        try:
            end_sno_int = int(float(end_sno.strip()))
        except ValueError:
            raise HTTPException(status_code=400, detail="End S.No must be a valid integer.")
            
    # Filter by S NO range if provided
    filtered_rows = []
    if start_sno_int is not None or end_sno_int is not None:
        sno_idx = -1
        sno_candidates = ["s no", "s.no", "sno", "serial number", "sr no", "sr.no", "serialno", "s_no"]
        for idx, header in enumerate(headers):
            if str(header).strip().lower() in sno_candidates:
                sno_idx = idx
                break
                
        if sno_idx == -1:
            raise HTTPException(
                status_code=400,
                detail="S NO column not found in Google Sheet. Please ensure your sheet contains an 'S NO' or 'S.No' column."
            )
            
        for r in rows:
            if sno_idx >= len(r):
                continue
            sno_val_str = str(r[sno_idx]).strip()
            if not sno_val_str:
                continue
            try:
                sno_val = int(float(sno_val_str))
            except ValueError:
                continue
                
            if start_sno_int is not None and sno_val < start_sno_int:
                continue
            if end_sno_int is not None and sno_val > end_sno_int:
                continue
                
            filtered_rows.append(r)
            
        if not filtered_rows:
            raise HTTPException(
                status_code=400,
                detail=f"No rows found with S NO in the range {start_sno_int or ''} to {end_sno_int or ''}."
            )
    else:
        filtered_rows = rows
        
    campaign_base_id = await get_next_campaign_id(spreadsheet_id)
    if start_sno_int is not None and end_sno_int is not None:
        campaign_id = f"{campaign_base_id}({start_sno_int}-{end_sno_int})"
    elif start_sno_int is not None:
        campaign_id = f"{campaign_base_id}({start_sno_int}-)"
    elif end_sno_int is not None:
        campaign_id = f"{campaign_base_id}(-{end_sno_int})"
    else:
        campaign_id = campaign_base_id
        
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
    print(f"DEBUG: Queueing campaign task for {len(filtered_rows)} contacts...")
    background_tasks.add_task(
        run_campaign_task, 
        campaign_id, platform, spreadsheet_id, filtered_rows, headers, mapping_dict, whatsapp_message, email_subject, email_body, base_url
    )
    
    return {
        "message": "Campaign started successfully", 
        "campaign_id": campaign_id, 
        "total_contacts": len(filtered_rows)
    }


@router.get("/campaign/emails-sent-today")
async def get_emails_sent_today(spreadsheet_id: str = None):
    from datetime import datetime, timedelta
    import imaplib
    import re
    
    # 1. Try to fetch direct count from Gmail IMAP (rolling 24 hours)
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_server = os.getenv("SMTP_SERVER")
    
    if smtp_user and smtp_pass and "gmail" in (smtp_server or "").lower():
        try:
            # Connect to Gmail IMAP
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(smtp_user, smtp_pass)
            
            # Find the Sent folder dynamically (supports multi-language accounts)
            sent_folder = None
            status, folder_list = mail.list()
            if status == 'OK':
                for folder_info in folder_list:
                    folder_str = folder_info.decode('utf-8')
                    if '\\sent' in folder_str.lower():
                        match = re.search(r'"([^"]+)"\s*$', folder_str)
                        if match:
                            sent_folder = match.group(1)
                            break
                            
            if not sent_folder:
                sent_folder = "[Gmail]/Sent Mail"
                
            # Select Sent folder
            mail.select(f'"{sent_folder}"')
            
            # Search for messages sent since yesterday
            yesterday_imap = (datetime.now() - timedelta(days=1)).strftime("%d-%b-%Y")
            status, data = mail.search(None, f'SINCE {yesterday_imap}')
            
            if status == 'OK' and data[0]:
                msg_ids_list = data[0].split()
                if msg_ids_list:
                    msg_ids_joined = ",".join(x.decode('utf-8') for x in msg_ids_list)
                    fetch_status, fetch_data = mail.fetch(msg_ids_joined, "(INTERNALDATE)")
                    
                    if fetch_status == 'OK':
                        total_sent = 0
                        from datetime import timezone
                        now_utc = datetime.now(timezone.utc)
                        for response_item in fetch_data:
                            item_bytes = None
                            if isinstance(response_item, tuple):
                                item_bytes = response_item[0]
                            elif isinstance(response_item, bytes):
                                item_bytes = response_item
                                
                            if item_bytes:
                                item_str = item_bytes.decode('utf-8', errors='ignore')
                                match = re.search(r'INTERNALDATE "([^"]+)"', item_str)
                                if match:
                                    date_str = match.group(1)
                                    try:
                                        # Parse with timezone offset (e.g. "%d-%b-%Y %H:%M:%S %z")
                                        msg_date = datetime.strptime(date_str.strip(), "%d-%b-%Y %H:%M:%S %z")
                                        if now_utc - msg_date < timedelta(hours=24):
                                            total_sent += 1
                                    except Exception as ex:
                                        print(f"DEBUG: Error parsing INTERNALDATE: {ex}")
                        mail.logout()
                        print(f"DEBUG: Successfully fetched direct Gmail rolling 24h count: {total_sent}")
                        return {"emails_sent_today": total_sent, "limit": 1000, "source": "gmail_direct"}
        except Exception as e:
            print(f"DEBUG: Gmail IMAP direct fetch failed: {e}. Falling back to sheet logs.")
            
    # 2. Fallback: Count from Google Sheet Logs + Memory (rolling 24 hours)
    spreadsheet_id = os.getenv("LOGS_SPREADSHEET_ID") or spreadsheet_id
    now = datetime.now()
    sheet_counted_contacts = set()
    
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
                    # row[1] is platform, row[4] is email, row[5] is timestamp
                    if row[1] == "Email" and len(row) > 5:
                        try:
                            row_date = datetime.strptime(str(row[5]).strip(), "%Y-%m-%d %I:%M:%S %p")
                            if now - row_date < timedelta(hours=24):
                                campaign_id = row[0]
                                email = row[4]
                                sheet_counted_contacts.add((campaign_id, email))
                        except Exception:
                            continue
        except Exception as e:
            print(f"DEBUG: Failed to read Logs Data sheet: {e}")
            
    memory_count = 0
    for campaign_id, campaign in campaign_manager.items():
        for res in campaign.get("results", []):
            if res.get("type") == "Email" and res.get("sent_time", ""):
                try:
                    res_date = datetime.strptime(res.get("sent_time"), "%Y-%m-%d %I:%M:%S %p")
                    if now - res_date < timedelta(hours=24):
                        email = res.get("email")
                        key = (campaign_id, email)
                        if key not in sheet_counted_contacts:
                            memory_count += 1
                except Exception:
                    continue
                    
    total_sent = len(sheet_counted_contacts) + memory_count
    return {"emails_sent_today": total_sent, "limit": 1000, "source": "sheet_fallback"}


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
        for res in campaign.get("results", []):
            if "sent_time" not in res:
                res["sent_time"] = ""
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
                            "reason": details_val,
                            "sent_time": row[5] if len(row) > 5 else ""
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
                        "reason": details_val,
                        "sent_time": row[5] if len(row) > 5 else ""
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
