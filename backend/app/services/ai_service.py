import os
import json
import openai
from dotenv import load_dotenv

load_dotenv(override=True)
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def detect_columns(columns: list, sample_rows: list):
    """
    Identifies phone, email, name, and company columns from dataset headers.
    """
    prompt = f"""
    Given the following dataset columns and sample data, identify which column represents:
    1. phone (the primary mobile/phone number)
    2. email (the primary email address)
    3. name (the person's full name or contact name)
    4. company (the company name, organization, or firm — leave empty string if not present)

    Columns: {columns}
    Sample Data: {sample_rows}

    Return ONLY a JSON object with keys: "phone", "email", "name", and "company".
    If a column is not found, use an empty string.
    Example: {{"phone": "Mobile", "email": "User Email", "name": "Client Name", "company": "Company Name"}}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"AI Detection Error: {e}")
        return {"phone": "", "email": "", "name": "", "company": ""}

async def rewrite_message(message: str, tone: str = "professional"):
    """
    Rewrites a message using AI to match a specific tone.
    """
    prompt = f"Rewrite this message to be more {tone}: \"{message}\". Keep it concise and suitable for WhatsApp/Email."
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI Rewriting Error: {e}")
        return message
