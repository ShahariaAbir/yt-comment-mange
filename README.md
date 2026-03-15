# 🚀 YouTube Comment AI Manager

A premium web application for YouTubers to manage comments and auto-reply using Google Gemini AI.

## ✨ Features

- **OAuth 2.0 Integration**: Securely connect your YouTube account.
- **Smart Filters**: Filter by unreplied comments, questions, or keyword search.
- **AI-Powered Replies**: Generate personalized, context-aware replies using Google Gemini AI.
- **Smart Gemini Model Selection**: Automatically uses available free Gemini models and lets you choose a model in Settings.
- **Tone Control**: Choose between Friendly, Professional, Casual, or Funny tones.
- **Batch Processing**: Reply to multiple comments in one click.
- **Real-time Stats**: Track your engagement metrics.

---

## 🛠️ Setup Instructions (Google Cloud & Gemini)

### 1. Set Up Google Cloud (YouTube API)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project**.
3. Go to **APIs & Services > Library** and enable **"YouTube Data API v3"**.
4. Go to **APIs & Services > OAuth consent screen**:
   - Choose **External**.
   - Fill in the required app info.
   - Add your email as a **Test User** (Crucial!).
5. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > API Key**. (Copy this)
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173`
     - `https://btcom-maneger.vercel.app`
   - **Authorized redirect URIs**: 
     - `http://localhost:5173`
     - `https://btcom-maneger.vercel.app`
   - Click Create and **Copy the Client ID**.

### 2. Set Up Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key**.
3. Create an API key in a new project. (Copy this)

### 3. Running the App
1. Install dependencies: `npm install`
2. Run the app: `npm run dev`
3. Open `http://localhost:5173` (local) or `https://btcom-maneger.vercel.app` (production) in your browser.
4. Click the **⚙️ Settings** icon in the app and paste your keys.
5. (Optional) In Settings, keep **Gemini Model** on **Auto** to always use an available free model.
6. Click **Connect YouTube Account** to start!

---

## 📝 Troubleshooting

- **Access Blocked**: If you see a "Google hasn't verified this app" screen, click **Advanced** then **Go to [App Name] (unsafe)**. This is normal for apps in development.
- **Scopes**: Ensure you added your email to the **Test Users** in the OAuth Consent Screen.
- **Quota**: The YouTube Data API has a free daily limit. If you have thousands of comments, you may hit the limit.
