// ─────────────────────────────────────────────────────────────────────────────
// AM Realty — Webflow Embed Script
// Paste inside a <script> tag in your Webflow page custom code or embed block.
// ─────────────────────────────────────────────────────────────────────────────

const CAPI_SERVER_URL = 'YOUR_RAILWAY_URL'; // e.g. https://am-realty-capi.up.railway.app

// Generate a UUID v4 for event deduplication
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * firePixel — fires a browser-side Meta Pixel event.
 *
 * @param {string} eventName  - e.g. 'Lead', 'QualifiedLead'
 * @param {object} customData - key/value pairs for Meta custom_data
 * @param {string} eventId    - UUID shared with fireCAPI for deduplication
 */
function firePixel(eventName, customData, eventId) {
  if (typeof fbq === 'undefined') {
    console.warn('[Pixel] fbq not loaded — skipping browser pixel');
    return;
  }
  fbq('track', eventName, customData || {}, { eventID: eventId });
  console.log('[Pixel] Fired:', eventName, '| eventID:', eventId);
}

/**
 * fireCAPI — sends the same event to your Railway CAPI server,
 * which forwards it to Meta's Conversions API.
 *
 * @param {string} eventName  - must match the Pixel event name exactly
 * @param {object} userData   - { em, ph, fn, ln } — plain text; server hashes them
 * @param {object} customData - same object you pass to firePixel
 * @param {string} eventId    - UUID shared with firePixel for deduplication
 */
async function fireCAPI(eventName, userData, customData, eventId) {
  const payload = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    user_data: userData || {},
    custom_data: customData || {},
    source_url: window.location.href,
  };

  try {
    const res = await fetch(`${CAPI_SERVER_URL}/capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      console.log('[CAPI] Sent:', eventName, '| eventID:', eventId, '| meta:', data.meta);
    } else {
      console.error('[CAPI] Error from server:', data);
    }
  } catch (err) {
    console.error('[CAPI] Network error:', err);
  }
}

/**
 * trackEvent — fires BOTH the browser pixel AND the CAPI server with
 * the same eventId so Meta deduplicates correctly.
 *
 * This is the function you should call from your form logic.
 *
 * @param {string} eventName
 * @param {object} userData   - { em, ph, fn, ln }
 * @param {object} customData - { qualification_score, funnel_source, … }
 */
function trackEvent(eventName, userData, customData) {
  const eventId = generateUUID();
  firePixel(eventName, customData, eventId);
  fireCAPI(eventName, userData, customData, eventId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage examples — wire these to your form stages:
// ─────────────────────────────────────────────────────────────────────────────

// Stage 1: Contact captured
function onLeadCaptured(email, phone, firstName, lastName) {
  trackEvent(
    'Lead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    { funnel_source: 'funnel-a', utm_source: getUtm('utm_source'), utm_campaign: getUtm('utm_campaign') }
  );
}

// Qualification started (Q1 displayed)
function onQualifyStart(email, phone, firstName, lastName) {
  trackEvent(
    'QualifyStart',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    { funnel_source: 'funnel-a' }
  );
}

// Lead qualified (score 5-7)
function onQualifiedLead(email, phone, firstName, lastName, score, tier) {
  trackEvent(
    'QualifiedLead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    {
      qualification_score: score,
      qualification_tier: tier,
      funnel_source: 'funnel-a',
      utm_source: getUtm('utm_source'),
      utm_campaign: getUtm('utm_campaign'),
    }
  );
}

// Lead disqualified (score < 5 or hard disqualifier)
function onDisqualifiedLead(email, phone, firstName, lastName, score, reason) {
  trackEvent(
    'DisqualifiedLead',
    { em: email, ph: phone, fn: firstName, ln: lastName },
    {
      qualification_score: score,
      disqualification_reason: reason || 'score',
      funnel_source: 'funnel-a',
    }
  );
}

// Helper: grab UTM from URL
function getUtm(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}
