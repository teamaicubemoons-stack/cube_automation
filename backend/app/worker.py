import os
import asyncio
from celery import Celery
from dotenv import load_dotenv
from app.services.whatsapp_service import send_whatsapp_message
from app.services.email_service import send_email
from app.services.sheet_service import update_row_status

load_dotenv()

celery = Celery(
    'tasks',
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

@celery.task(bind=True, max_retries=2)
def send_whatsapp_task(self, row_index, phone, message):
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(send_whatsapp_message(phone, message))
    
    # Update sheet
    loop.run_until_complete(update_row_status(row_index, result['status'], result.get('reason', '')))
    
    if result['status'] == "Failed":
        raise self.retry(countdown=30)
    return result

@celery.task(bind=True, max_retries=2)
def send_email_task(self, row_index, email, subject, body):
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(send_email(email, subject, body))
    
    # Update sheet
    loop.run_until_complete(update_row_status(row_index, result['status'], result.get('reason', '')))
    
    if result['status'] == "Failed":
        raise self.retry(countdown=30)
    return result
