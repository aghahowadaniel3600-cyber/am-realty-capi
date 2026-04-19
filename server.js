const express = require('express');
const crypto = require('crypto');
const https = require('https');

const app = express();
app.use(express.json());

// CORS — allow requests from amrealtyltd.com and Webflow preview domains only
const ALLOWED_ORIGINS = [
  'https://amrealtyltd.com',
  'https://www.amrealtyltd.com',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any Webflow preview subdomain (e.g. am-realty.webflow.io, preview.webflow.com)
  if (/^https:\/\/[a-z0-9-]+\.webflow\.io$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.webflow\.com$/i.test(origin)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PIXEL_ID = process.env.META_PIXEL_ID || '1083894726946341';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// SHA-256 hash helper — lowercase + trim before hashing
function hash(value) {
  if (!value) return undefined;
  const cleaned = String(value).toLowerCase().trim();
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

// Normalise phone: strip everything except digits and a leading +
function normalisePhone(ph) {
  if (!ph) return undefined;
  const s = String(ph).trim();
  // Keep leading + then strip all non-digits from the rest
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  return hasPlus ? '+' + digits : digits;
}

// POST /capi
app.post('/capi', async (req, res) => {
  if (!ACCESS_TOKEN) {
    console.error('[CAPI] META_ACCESS_TOKEN is not set');
    return res.status(500).json({ error: 'Server misconfiguration: missing access token' });
  }

  const {
    event_name,
    event_time,
    event_id,
    user_data = {},
    custom_data = {},
    source_url,
  } = req.body;

  if (!event_name) {
    return res.status(400).json({ error: 'event_name is required' });
  }

  // Build hashed user_data
  const hashedUserData = {};

  if (user_data.em) hashedUserData.em = hash(user_data.em);
  if (user_data.ph) hashedUserData.ph = hash(normalisePhone(user_data.ph));
  if (user_data.fn) hashedUserData.fn = hash(user_data.fn);
  if (user_data.ln) hashedUserData.ln = hash(user_data.ln);

  // Attach client IP and user-agent when available (improves match rate)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  if (clientIp) hashedUserData.client_ip_address = clientIp;
  if (userAgent) hashedUserData.client_user_agent = userAgent;

  // Build the CAPI event payload
  const capiEvent = {
    event_name,
    event_time: event_time || Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: hashedUserData,
  };

  if (event_id) capiEvent.event_id = event_id;
  if (source_url) capiEvent.event_source_url = source_url;
  if (Object.keys(custom_data).length > 0) capiEvent.custom_data = custom_data;

  const payload = JSON.stringify({ data: [capiEvent] });

  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  console.log(`[CAPI] Sending event: ${event_name} (id: ${event_id || 'none'})`);

  try {
    const metaRes = await postJson(url, payload);

    if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
      console.log(`[CAPI] Meta accepted event: ${event_name} — response: ${metaRes.body}`);
      return res.status(200).json({ ok: true, meta: JSON.parse(metaRes.body) });
    } else {
      console.error(`[CAPI] Meta rejected event: ${metaRes.statusCode} — ${metaRes.body}`);
      return res.status(502).json({ error: 'Meta API error', detail: JSON.parse(metaRes.body) });
    }
  } catch (err) {
    console.error('[CAPI] Network error forwarding to Meta:', err.message);
    return res.status(502).json({ error: 'Failed to reach Meta API', detail: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', pixelId: PIXEL_ID }));

// Simple promisified HTTPS POST
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[CAPI] Server running on port ${PORT}`));
