import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

AISENSY_API_KEY = os.getenv("WHATSAPP_API_KEY")
CAMPAIGN_NAME = os.getenv("WHATSAPP_CAMPAIGN_NAME")
AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2"

async def send_whatsapp_message(phone: str, message: str):
    """
    Sends a message using AiSensy API.
    Note: AiSensy requires a pre-approved template. 
    This implementation assumes your campaign uses the message as a template parameter.
    """
    if not AISENSY_API_KEY or not CAMPAIGN_NAME:
        return {"status": "Failed", "reason": "AiSensy API Key or Campaign Name missing in .env"}

    payload = {
        "apiKey": AISENSY_API_KEY,
        "campaignName": CAMPAIGN_NAME,
        "destination": phone.strip("+").strip(),
        "userName": "Customer",
        "templateParams": [], # Static template has no variables
        "source": "API"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"DEBUG: Sending to AiSensy -> Destination: {phone}, Campaign: {CAMPAIGN_NAME}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(AISENSY_URL, headers=headers, json=payload)
            print(f"DEBUG: AiSensy Response Code: {response.status_code}")
            print(f"DEBUG: AiSensy Response Body: {response.text}")
            
            if response.status_code in [200, 201, 202]:
                return {"status": "Sent", "response": response.json()}
            else:
                return {"status": "Failed", "reason": response.text}
        except Exception as e:
            print(f"DEBUG: httpx Error: {e}")
            return {"status": "Failed", "reason": str(e)}

