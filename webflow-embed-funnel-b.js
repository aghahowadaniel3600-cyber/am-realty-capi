// ─────────────────────────────────────────────────────────────────────────────
// AM Realty — CAPI Embed: FUNNEL B  (/discover)
// Paste the entire contents of this file inside a <script>...</script> tag
// in Webflow → Page Settings → Custom Code → Before </body>
// ─────────────────────────────────────────────────────────────────────────────

// ── CONFIG (only edit these two lines) ───────────────────────────────────────
var CAPI_URL        = 'https://am-realty-capi-production.up.railway.app';
var FUNNEL_SOURCE   = 'funnel-b';
var SOURCE_URL      = 'https://amrealtyltd.com/discover';
// ─────────────────────────────────────────────────────────────────────────────

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
function trackEvent(eventName, userData, customData) {
  var eventId = generateUUID();
  firePixel(eventName, customData, eventId);   // browser
  fireCAPI(eventName, userData, customData, eventId);  // server → Meta
}

// ── EVENT HELPERS ─────────────────────────────────────────────────────────────

// Page loaded
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

// Funnel B opt-in form submitted (name + email/phone only — no qualification)
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

// ── AUTO-FIRE PageView on load ────────────────────────────────────────────────
window.addEventListener('load', function () {
  onPageView();
});
