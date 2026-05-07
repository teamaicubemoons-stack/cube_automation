# 🌟 Bulk Messaging System: How It Works (Sheet-Based)

In this version, we use **Google Sheets** as the main storage. It’s like having a database that you can open and edit manually anytime!

---

## 🛤️ The User Journey (Step-by-Step)

### Step 1: Upload or Connect Sheet
You can either upload a file or directly link a **Google Sheet**. The system will read your contacts directly from the rows of your sheet.

### Step 2: AI Magic (Smart Detection)
Once the data is pulled from the Sheet:
*   **Column Discovery:** AI identifies which column is "Phone", "Email", and "Name".
*   **Auto-Cleanup:** AI formats numbers and emails so they are ready to send.

### Step 3: Compose & Personalize
Write your message using tags like `{name}`. The system will look at each row in your Google Sheet, pick the name, and create a unique message for every person.

### Step 4: The Sending Queue & Delay
Messages are queued up. We wait **30 seconds** between each message to ensure your WhatsApp/Email account stays healthy and doesn't get marked as spam.

### Step 5: Live Updates in YOUR Sheet!
This is the best part! As messages are sent, you can watch your **Google Sheet update in real-time**:
*   The system adds a "Status" column to your sheet.
*   It marks rows as ✅ **Sent** or ❌ **Failed**.
*   It even writes the "Reason" if a message fails (e.g., "Invalid Number").

---

## 🤖 Why use Google Sheets as a Database?

1.  **Full Control:** You don't need a database manager. You can see all your data in a familiar spreadsheet format.
2.  **Easy Sharing:** You can share the sheet with your team, and they can see the progress of the campaign live.
3.  **No Technical Setup:** No complicated SQL databases to install or maintain.

---

## 🛡️ Security & Safety

*   **Human-like Speed:** We send messages slowly (1 per 30s) to look like a real person sending them.
*   **Reliable Logs:** Every attempt is recorded in the sheet, so you have a permanent record of what happened.

---

## 📋 Summary of Features

| Feature | What it does for you |
| :--- | :--- |
| **Sheet Integration** | Use your existing Google Sheets as a database. |
| **AI Detection** | Automatically finds phone and email columns. |
| **Real-time Logging** | Status updates appear directly in your spreadsheet. |
| **Safety First** | Automatic delays and retries for reliable delivery. |

---

**Your Google Sheet is now your command center!**
