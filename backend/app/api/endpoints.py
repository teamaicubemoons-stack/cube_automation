from fastapi import APIRouter, UploadFile, File, Form
import pandas as pd
import io
import json
from app.services.ai_service import detect_columns, rewrite_message
from app.services.sheet_service import read_sheet_data, ensure_headers
from app.worker import send_whatsapp_task, send_email_task

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

@router.post("/start-campaign")
async def start_campaign(
    platform: str = Form(...), # "whatsapp", "email", or "both"
    whatsapp_message: str = Form(None),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    mapping: str = Form(...) # JSON string of detected columns
):
    """
    Starts the messaging campaign by queueing tasks.
    """
    mapping_dict = json.loads(mapping)
    data = await read_sheet_data()
    if not data:
        return {"error": "No data found in Google Sheet"}
    
    await ensure_headers()
    
    headers = data[0]
    rows = data[1:]
    
    phone_idx = headers.index(mapping_dict['phone']) if mapping_dict.get('phone') in headers else -1
    email_idx = headers.index(mapping_dict['email']) if mapping_dict.get('email') in headers else -1
    name_idx = headers.index(mapping_dict['name']) if mapping_dict.get('name') in headers else -1
    
    task_ids = []
    
    for i, row in enumerate(rows):
        row_index = i + 1 # 1-indexed for sheets, plus header offset
        
        name = row[name_idx] if name_idx != -1 else "Customer"
        
        # WhatsApp
        if platform in ["whatsapp", "both"] and phone_idx != -1:
            phone = row[phone_idx]
            msg = whatsapp_message.replace("{name}", name)
            task = send_whatsapp_task.delay(row_index, phone, msg)
            task_ids.append(task.id)
            
        # Email
        if platform in ["email", "both"] and email_idx != -1:
            email = row[email_idx]
            body = email_body.replace("{name}", name)
            task = send_email_task.delay(row_index, email, email_subject, body)
            task_ids.append(task.id)
            
    return {"message": "Campaign started", "task_count": len(task_ids)}

@router.post("/rewrite")
async def ai_rewrite(message: str = Form(...), tone: str = Form("professional")):
    rewritten = await rewrite_message(message, tone)
    return {"rewritten": rewritten}
