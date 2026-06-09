import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv(override=True)

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

async def send_email(to_email: str, subject: str, body: str, tracking_url: str = None):
    """
    Sends an email using SMTP.
    """
    import re
    if tracking_url:
        if re.search(r'<[a-zA-Z/][^>]*>', body):
            if "</body>" in body:
                body = body.replace("</body>", f'<img src="{tracking_url}" width="1" height="1" style="display:none;" alt="" /></body>')
            else:
                body += f'<img src="{tracking_url}" width="1" height="1" style="display:none;" alt="" />'
        else:
            body = f'<html><body>{body.replace(chr(10), "<br>")}<img src="{tracking_url}" width="1" height="1" style="display:none;" alt="" /></body></html>'

    msg = MIMEMultipart('alternative')
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = subject
    
    # Check if the body contains HTML elements
    if re.search(r'<[a-zA-Z/][^>]*>', body):
        # Convert some tags for the text fallback
        text_fallback = re.sub(r'<br\s*/?>', '\n', body, flags=re.IGNORECASE)
        text_fallback = re.sub(r'<p\s*/?>', '\n\n', text_fallback, flags=re.IGNORECASE)
        text_fallback = re.sub(r'<[^>]+>', '', text_fallback)
        
        msg.attach(MIMEText(text_fallback, 'plain', 'utf-8'))
        msg.attach(MIMEText(body, 'html', 'utf-8'))
    else:
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return {"status": "Sent"}
    except Exception as e:
        return {"status": "Failed", "reason": str(e)}
