# AM Realty — Meta CAPI Server

Server-side Meta Conversions API relay for the AM Realty lead funnel.  
Receives events from the Webflow embed, hashes PII, and forwards to Meta.

---

## Project structure

```
am-realty-capi/
├── server.js          # Express server — the only file you need to run
├── package.json
├── railway.json       # Railway deployment config
├── .env.example       # Environment variable template
├── webflow-embed.js   # Client-side JS to paste into Webflow
└── README.md
```

---

## 1 · Get your Meta CAPI access token

1. Go to **Meta Business Manager** → [business.facebook.com](https://business.facebook.com)
2. **Settings → Users → System Users** → click **Add**
3. Create a System User with role **Admin**
4. Click **Generate Token** on the system user
5. Select your **Ad Account** and tick these permissions:
   - `ads_management`
   - `pages_show_list`
   - `business_management`
6. Copy the token — this is your `META_ACCESS_TOKEN`

> **Security note:** never commit this token to git. Use environment variables only.

---

## 2 · Local development

```bash
# Clone / open the folder
cd am-realty-capi

# Install dependencies
npm install

# Create your local env file
cp .env.example .env
# Edit .env and paste your real META_ACCESS_TOKEN

# Start the server
npm run dev
# → Server running on port 3000
```

Test it:
```bash
curl -X POST http://localhost:3000/capi \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "Lead",
    "event_id": "test-uuid-001",
    "user_data": {
      "em": "test@amrealtyltd.com",
      "ph": "+2348012345678",
      "fn": "Test",
      "ln": "User"
    },
    "custom_data": {
      "funnel_source": "funnel-a"
    },
    "source_url": "https://amrealtyltd.com/enquire"
  }'
```

Expected response:
```json
{ "ok": true, "meta": { "events_received": 1, ... } }
```

---

## 3 · Deploy on Railway

### Option A — via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create a new project and link
railway init

# Set environment variables
railway variables set META_ACCESS_TOKEN=your_token_here
railway variables set META_PIXEL_ID=1083894726946341

# Deploy
railway up
```

### Option B — via Railway dashboard (GitHub)

1. Push this folder to a **GitHub repository**
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
3. Select the repo
4. In **Variables**, add:
   | Key | Value |
   |-----|-------|
   | `META_ACCESS_TOKEN` | your system user token |
   | `META_PIXEL_ID` | `1083894726946341` |
5. Railway auto-detects Node.js and deploys — your URL will be something like  
   `https://am-realty-capi.up.railway.app`

---

## 4 · Add Webflow embed

1. Open `webflow-embed.js`
2. Replace `YOUR_RAILWAY_URL` with your actual Railway deployment URL
3. In Webflow Designer → **Page Settings → Custom Code → Before </body>**, paste the entire script inside `<script>...</script>` tags
4. Call `trackEvent(...)` from your existing form logic at each stage

### Event wiring reference

| Funnel stage | Function to call |
|---|---|
| Stage 1 form submitted | `onLeadCaptured(email, phone, firstName, lastName)` |
| Q1 displayed | `onQualifyStart(email, phone, firstName, lastName)` |
| Score 5–7 | `onQualifiedLead(email, phone, firstName, lastName, score, tier)` |
| Score < 5 / disqualifier | `onDisqualifiedLead(email, phone, firstName, lastName, score, reason)` |

---

## 5 · Test with curl (production)

Replace `YOUR_RAILWAY_URL` with your actual URL:

```bash
curl -X POST https://YOUR_RAILWAY_URL/capi \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "QualifiedLead",
    "event_time": 1713000000,
    "event_id": "dedup-test-abc123",
    "user_data": {
      "em": "jane@example.com",
      "ph": "+2348099887766",
      "fn": "Jane",
      "ln": "Doe"
    },
    "custom_data": {
      "qualification_score": 6,
      "qualification_tier": "QUALIFIED-A",
      "funnel_source": "funnel-a",
      "utm_source": "meta",
      "utm_campaign": "brookes-end"
    },
    "source_url": "https://amrealtyltd.com/enquire"
  }'
```

Health check:
```bash
curl https://YOUR_RAILWAY_URL/health
# → { "status": "ok", "pixelId": "1083894726946341" }
```

---

## 6 · Verify events in Meta

1. **Events Manager → your Pixel → Test Events tab**
2. Set the test URL to your Webflow page
3. Submit the form — you should see both a **Browser** event and a **Server** event for each action, with matching `event_id` values (Meta shows them as one deduplicated event)

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `META_ACCESS_TOKEN` | Yes | System User token from Meta Business Manager |
| `META_PIXEL_ID` | No | Defaults to `1083894726946341` |
| `PORT` | No | Railway injects this automatically |
