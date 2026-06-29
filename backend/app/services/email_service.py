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

async def send_email(
    to_email: str,
    subject: str,
    body: str,
    tracking_url: str = None,
    unsubscribe_url: str = None
):
    """
    Sends an email using SMTP.
    Appends an invisible tracking pixel and an unsubscribe link footer if URLs are provided.
    """
    import re

    # ── Build unsubscribe footer HTML ──────────────────────────────────────────
    unsub_footer_html = ""
    unsub_footer_text = ""
    if unsubscribe_url:
        unsub_footer_html = (
            f'<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;'
            f'text-align:center;font-family:Arial,sans-serif;">'
            f'<p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">'
            f'You are receiving this email because you subscribed to our newsletter.<br>'
            f'If you no longer wish to receive these emails, '
            f'<a href="{unsubscribe_url}" style="color:#2563eb;text-decoration:underline;">click here to unsubscribe</a>.'
            f'</p></div>'
        )
        unsub_footer_text = (
            f"\n\n---\nYou are receiving this because you subscribed to our newsletter.\n"
            f"To unsubscribe, visit: {unsubscribe_url}"
        )

    # ── Inject tracking pixel ──────────────────────────────────────────────────
    is_html = re.search(r'<[a-zA-Z/][^>]*>', body)

    if is_html:
        # Body is already HTML
        if tracking_url:
            tracking_pixel = f'<img src="{tracking_url}" width="1" height="1" style="display:none;" alt="" />'
        else:
            tracking_pixel = ""

        if "</body>" in body:
            body = body.replace(
                "</body>",
                f"{unsub_footer_html}{tracking_pixel}</body>"
            )
        else:
            body = body + unsub_footer_html + tracking_pixel
    else:
        # Plain text body — wrap in HTML
        html_body = (
            f'<html><body>'
            f'{body.replace(chr(10), "<br>")}'
            f'{unsub_footer_html}'
        )
        if tracking_url:
            html_body += f'<img src="{tracking_url}" width="1" height="1" style="display:none;" alt="" />'
        html_body += '</body></html>'
        body = html_body

    # Append plain-text unsubscribe footer (for text fallback)
    msg = MIMEMultipart('alternative')
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = subject

    # Check again after potential HTML wrapping
    if re.search(r'<[a-zA-Z/][^>]*>', body):
        text_fallback = re.sub(r'<br\s*/?>', '\n', body, flags=re.IGNORECASE)
        text_fallback = re.sub(r'<p\s*/?>', '\n\n', text_fallback, flags=re.IGNORECASE)
        text_fallback = re.sub(r'<[^>]+>', '', text_fallback)
        text_fallback += unsub_footer_text

        msg.attach(MIMEText(text_fallback, 'plain', 'utf-8'))
        msg.attach(MIMEText(body, 'html', 'utf-8'))
    else:
        msg.attach(MIMEText(body + unsub_footer_text, 'plain', 'utf-8'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return {"status": "Sent"}
    except Exception as e:
        return {"status": "Failed", "reason": str(e)}
