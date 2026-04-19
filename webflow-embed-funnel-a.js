// ─────────────────────────────────────────────────────────────────────────────
// AM Realty — CAPI Embed: FUNNEL A  (/enquire)
// Paste the entire contents of this file inside a <script>...</script> tag
// in Webflow → Page Settings → Custom Code → Before </body>
// ─────────────────────────────────────────────────────────────────────────────

// ── CONFIG (only edit these two lines) ───────────────────────────────────────
var CAPI_URL        = 'YOUR_RAILWAY_URL';          // e.g. https://am-realty-capi.up.railway.app
var FUNNEL_SOURCE   = 'funnel-a';
var SOURCE_URL      = 'https://amrealtyltd.com/enquire';
// ─────────────────────────────────────────────────────────────────────────────

// Standard Meta events use fbq('track', ...)
// Custom events (anything Meta doesn't know natively) use fbq('trackCustom', ...)
var STANDARD_EVENTS = ['PageView', 'Lead', 'ViewContent', 'CompleteRegistration'];

// ── CORE HELPERS ─────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getUtm(key) {
  return new URLSearchParams(window.location.search).get(key) || undefined;
}

// ── BROWSER PIXEL ─────────────────────────────────────────────────────────────
/**
 * firePixel — fires the browser-side Meta Pixel.
 * Uses fbq('track') for standard events, fbq('trackCustom') for custom ones.
 *
 * @param {string} eventName
 * @param {object} params   — visible event parameters (not hashed here)
 * @param {string} eventId  — UUID shared with CAPI for deduplication
 */
function firePixel(eventName, params, eventId) {
  if (typeof fbq === 'undefined') {
    console.warn('[Pixel] fbq not loaded — browser pixel skipped');
    return;
  }
  var method = STANDARD_EVENTS.includes(eventName) ? 'track' : 'trackCustom';
  fbq(method, eventName, params || {}, { eventID: eventId });
  console.log('[Pixel]', eventName, '| method:', method, '| eventID:', eventId);
}

// ── CAPI ──────────────────────────────────────────────────────────────────────
/**
 * fireCAPI — sends the event to the Railway CAPI server.
 * The server hashes em/ph/fn/ln before forwarding to Meta.
 *
 * @param {string} eventName
 * @param {object} userData   — { em, ph, fn, ln } plain text
 * @param {object} customData — extra params sent to Meta as custom_data
 * @param {string} eventId    — UUID shared with firePixel for deduplication
 */
async function fireCAPI(eventName, userData, customData, eventId) {
  var payload = {
    event_name:  eventName,
    event_time:  Math.floor(Date.now() / 1000),
    event_id:    eventId,
    user_data:   userData   || {},
    custom_data: customData || {},
    source_url:  SOURCE_URL,
  };

  try {
    var res  = await fetch(CAPI_URL + '/capi', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    var data = await res.json();
    if (res.ok) {
      console.log('[CAPI] Sent:', eventName, '| eventID:', eventId, '| received:', data.meta?.events_received);
    } else {
      console.error('[CAPI] Server error:', data);
    }
  } catch (err) {
    console.error('[CAPI] Network error:', err);
  }
}

// ── MAIN: trackEvent ──────────────────────────────────────────────────────────
/**
 * trackEvent — generates ONE shared UUID then fires both the browser
 * pixel and CAPI simultaneously. Meta sees matching event_ids and
 * counts them as a single event (no double-counting).
 *
 * This is the only function you need to call from your form logic.
 *
 * @param {string} eventName
 * @param {object} userData   — { em, ph, fn, ln }
 * @param {object} customData — any extra data for Meta
 * @param {object} pixelParams — (optional) subset of customData to show in browser pixel
 */
function trackEvent(eventName, userData, customData, pixelParams) {
  var eventId = generateUUID();
  firePixel(eventName, pixelParams || customData, eventId);   // browser
  fireCAPI(eventName, userData, customData, eventId);          // server → Meta
}

// ── EVENT HELPERS (call these from your form stages) ─────────────────────────

// Page loaded — no user data yet
function onPageView() {
  var utmData = {
    funnel_source:  FUNNEL_SOURCE,
    utm_source:     getUtm('utm_source'),
    utm_medium:     getUtm('utm_medium'),
    utm_campaign:   getUtm('utm_campaign'),
    utm_content:    getUtm('utm_content'),
  };
  trackEvent('PageView', {}, utmData);
}

// Stage 1: contact form submitted
function onLeadCaptured(email, phone, firstName, lastName) {
  trackEvent(
    'Lead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    {
      funnel_source:  FUNNEL_SOURCE,
      utm_source:     getUtm('utm_source'),
      utm_campaign:   getUtm('utm_campaign'),
    }
  );
}

// Q1 of qualification form displayed
function onQualifyStart(email, phone, firstName, lastName) {
  trackEvent(
    'QualifyStart',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    { funnel_source: FUNNEL_SOURCE }
  );
}

// Lead scored 5-7 out of 7
function onQualifiedLead(email, phone, firstName, lastName, score, tier) {
  trackEvent(
    'QualifiedLead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    {
      qualification_score:  score,
      qualification_tier:   tier,
      funnel_source:        FUNNEL_SOURCE,
      utm_source:           getUtm('utm_source'),
      utm_campaign:         getUtm('utm_campaign'),
    }
  );
}

// Lead scored below 5 or hit a hard disqualifier
function onDisqualifiedLead(email, phone, firstName, lastName, score, reason) {
  trackEvent(
    'DisqualifiedLead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    {
      qualification_score:        score,
      disqualification_reason:    reason || 'score',
      funnel_source:              FUNNEL_SOURCE,
    }
  );
}

// ── AUTO-FIRE PageView on load ────────────────────────────────────────────────
// Waits for the page (and fbq) to be ready before firing.
window.addEventListener('load', function () {
  onPageView();
});
