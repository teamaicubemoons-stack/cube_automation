# 🚀 AI-Powered Bulk Messaging System: Setup Guide (Sheet-Based DB)

This document provides a step-by-step technical guide to setting up the Bulk Messaging System using **Google Sheets** as the database.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

1.  **Python 3.9+** (For the FastAPI backend)
2.  **Node.js & npm** (For the React frontend)
3.  **Redis** (Message broker for Celery)
4.  **Google Cloud Console Account** (To enable Google Sheets API)
5.  **Meta WhatsApp Developer Account** (For WhatsApp API)
6.  **OpenAI API Key** (For AI processing)

---

## 📂 Project Structure

```text
Cube_AI/
├── backend/            # FastAPI Project
│   ├── app/
│   │   ├── main.py     # Entry point
│   │   ├── api/        # Endpoints
│   │   ├── core/       # Config & Security
│   │   ├── services/   # AI, Google Sheets & Sending Logic
│   │   └── worker.py   # Celery Tasks
│   ├── .env            # Backend Secrets
│   ├── service_account.json # Google Cloud Credentials
│   └── requirements.txt
├── frontend/           # React Project
│   ├── src/
│   └── .env
└── README.md
```

---

## 1️⃣ Google Sheets API Setup

Instead of PostgreSQL, we use Google Sheets for data storage.
1.  Go to **Google Cloud Console**.
2.  Create a Project and enable **Google Sheets API** and **Google Drive API**.
3.  Create a **Service Account**, download the **JSON key**, and save it as `backend/service_account.json`.
4.  Create a new Google Sheet and **Share** it with the email address found in your `service_account.json`.

---

## 2️⃣ Backend Setup (FastAPI)

1.  **Navigate & Install:**
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **Configure Environment Variables (.env):**
    ```env
    GOOGLE_SHEET_ID=your_google_sheet_id_here
    GOOGLE_APPLICATION_CREDENTIALS=service_account.json
    REDIS_URL=redis://localhost:6379/0
    OPENAI_API_KEY=your_openai_key_here
    WHATSAPP_TOKEN=your_meta_token
    WHATSAPP_PHONE_ID=your_phone_id
    SMTP_SERVER=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_app_password
    ```

3.  **Start the Backend Server:**
    ```bash
    uvicorn app.main:app --reload
    ```

---

## 3️⃣ Queue & Frontend Setup

*Follow the same steps as the previous guide for Redis, Celery, and React.*

---

## ⚙️ Key Technical Features (Sheet Edition)

*   **Google Sheets API:** Acts as the primary database. Every status update (Sent/Failed) is written directly to the sheet rows.
*   **FastAPI + Celery:** Manages the background message queue to prevent API rate limits.
*   **No Migrations Needed:** Since there is no SQL database, you don't need to run `alembic` or `sql` commands. Just ensure the Sheet ID is correct.

---

## 🚨 Safety Measures

*   **API Quotas:** Be mindful of Google Sheets API rate limits (usually 60 requests per minute).
*   **30-Second Delay:** Still mandatory to keep messaging accounts safe.

---

## 🔍 Testing Email Open Tracking Locally

Email opens are tracked via a 1x1 transparent tracking pixel embedded in the email body. 
To manually test and update a recipient's mail status to **"Seen"** locally, you can open the following URL format in your web browser (or send a GET request):

```text
http://localhost:8000/api/campaign/track-open?campaign_id=CAM001(20-25)&email=harshdewangan1472@gmail.com
```

This will trigger the tracking endpoint, update the status to "Seen" in-memory, and synchronize the update directly to the Google Sheet logs under the `Logs Data` tab.
