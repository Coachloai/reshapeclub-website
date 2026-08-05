/* Result page renderer — Men's Performance Assessment.
   Renders archetype reveal, readout, objections, radar chart, and booking calendar.
   Uses same Supabase backend as the women's assessment.
*/
(function(){
  var SUPABASE_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var SCORE_FN     = SUPABASE_URL + '/functions/v1/score-assessment';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

  function $(s){ return document.querySelector(s); }

  function getSessionId(){
    return new URLSearchParams(window.location.search).get('session_id');
  }

  function showError(msg){
    $('#loading-state').style.display = 'none';
    $('#error-state').style.display = 'flex';
    if (msg) $('#error-msg').textContent = msg;
  }

  // ── Men's archetype copy (client-side fallback) ──
  var ARCHETYPE_COPY = {
    cortisol_dominant_decline: {
      headline: "You're a Cortisol-Dominant Decline.",
      mirror: "<p>Based on what you shared, your body is running in <strong>chronic stress mode</strong>. You're waking at night, fat is settling around your midsection, and your energy crashes hard in the afternoon. That's a textbook cortisol signature.</p><p>What's happening: sustained cortisol elevation suppresses testosterone production, blocks GH release during sleep, drives visceral belly fat storage, and leaves you running on adrenaline instead of actual energy. Your body isn't broken — it's doing exactly what chronically elevated cortisol tells it to do.</p>",
      objections: [
        { title: "Training harder made it worse", body: "Intense training raises cortisol further. For your pattern, you need strategic strength work and recovery protocols — not more punishment sessions." },
        { title: "Cutting calories backfired", body: "Caloric restriction is a stressor. For a cortisol-dominant body, eating less raises cortisol more — your body holds onto belly fat harder." },
        { title: "Supplements didn't touch it", body: "No amount of ashwagandha fixes a cortisol problem driven by sleep disruption, chronic overwork, and under-recovery. The protocol has to address the root signal." }
      ]
    },
    testosterone_decline: {
      headline: "You're a Testosterone Decline Pattern.",
      mirror: "<p>Based on what you shared, your <strong>testosterone has been dropping</strong> — your drive is dulled, your body composition has shifted, and the training response you used to get has stalled or reversed. This is the most common pattern in men 35–50.</p><p>What's happening: testosterone declines ~1–2% per year after 30, but lifestyle factors can accelerate that by 3–5x. Poor sleep, chronic stress, excess body fat, and insulin resistance all actively suppress testosterone production. The good news: most of this is reversible without TRT.</p>",
      objections: [
        { title: "Same effort, different body", body: "Your body literally processes the same training stimulus differently now. The hormonal environment around the session changed — not your work ethic." },
        { title: "Test boosters didn't work", body: "Over-the-counter testosterone supplements address maybe 5% of the picture. The real levers are sleep architecture, cortisol management, and body composition." },
        { title: "You assumed it was just age", body: "Age is a factor, but it's a 1% annual decline — not the cliff you're experiencing. The acceleration is environmental and fixable." }
      ]
    },
    metabolic_resistance_men: {
      headline: "You're a Metabolic Resistance Pattern.",
      mirror: "<p>Based on what you shared, your body has <strong>stopped responding to the inputs</strong> that should be working. You're training, you're eating reasonably, and the needle won't move. Your energy crashes after meals, and the weight you do carry sits stubbornly around your midsection.</p><p>What's happening: insulin resistance and leptin dysregulation are blocking your body's ability to burn fat and build muscle. Your cells have become deaf to the signals that should be driving body composition change. The result is a body that holds onto fat aggressively regardless of what you do.</p>",
      objections: [
        { title: "Calorie deficits stopped working", body: "Once insulin is dysregulated, eating less makes you hungrier and more fatigued, not leaner. The lever isn't smaller — it's different." },
        { title: "Keto gave temporary results", body: "Low-carb often works for 4–6 weeks then plateaus. That's not failure — that's metabolic resistance reasserting. The approach needs to evolve." },
        { title: "More cardio just made you hungrier", body: "Cardio without addressing insulin signalling is like running on a treadmill — literally and figuratively. Strength work and meal timing matter more." }
      ]
    },
    compound_pattern_men: {
      headline: "You're a Compound Pattern.",
      mirror: "<p>Based on what you shared, your symptoms span <strong>all three patterns</strong> — cortisol dominance, testosterone decline, and metabolic resistance are all active. About 1 in 8 men score this way, and it almost always means the same thing: you've been addressing symptoms in isolation instead of the system.</p><p>What's happening: when all three patterns stack, the order matters more than the intensity. Fix cortisol first (sleep, stress, recovery), then metabolic signalling (insulin, meal structure), then the anabolic environment follows. Do them all at once and nothing moves.</p>",
      objections: [
        { title: "Multi-front approaches failed", body: "When you tried to fix everything at once — gym, diet, supplements, sleep — nothing stuck. That's the compound trap, not your fault." },
        { title: "Each fix helped briefly, then stalled", body: "Your pattern needs sequencing, not stacking. Each layer unlocks the next." },
        { title: "You probably need bloodwork", body: "This is the one pattern where I'll likely recommend a panel before we set the plan. Testosterone, cortisol, fasting insulin, and thyroid at minimum." }
      ]
    }
  };

  var ARCHETYPE_LABEL = {
    cortisol_dominant_decline: 'Cortisol-Dominant Decline',
    testosterone_decline:      'Testosterone Decline Pattern',
    metabolic_resistance_men:  'Metabolic Resistance Pattern',
    compound_pattern_men:      'Compound Pattern'
  };

  function fetchResult(sid){
    var cacheKey = 'reshape_mens_result_' + sid;
    try {
      var cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached && cached.primary_archetype) return Promise.resolve(cached);
    } catch(e){}
    return fetch(SCORE_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ANON_KEY,
        'apikey': ANON_KEY
      },
      body: JSON.stringify({ session_id: sid })
    }).then(function(r){
      return r.json().then(function(j){
        if (r.status !== 200) throw new Error(j && j.error ? j.error : 'score failed');
        try { sessionStorage.setItem(cacheKey, JSON.stringify(j)); } catch(e){}
        return j;
      });
    });
  }

  function renderResult(data){
    $('#loading-state').style.display = 'none';
    $('#result-state').style.display = 'block';

    var primary = data.primary_archetype;
    var serverReadout = (data.readout && !data.readout.stub) ? data.readout : null;
    var copy = serverReadout || ARCHETYPE_COPY[primary];
    var label = ARCHETYPE_LABEL[primary] || primary;

    var headline = (copy && copy.headline) || ("You're a " + label + ".");
    var headlineHtml = headline.replace(label, '<em>' + label + '</em>');
    $('#result-headline').innerHTML = headlineHtml;

    if (copy && copy.secondary){
      $('#result-secondary').textContent = copy.secondary;
    } else if (data.secondary_archetype && data.secondary_archetype !== primary){
      $('#result-secondary').textContent = 'With notable signals from the ' + (ARCHETYPE_LABEL[data.secondary_archetype] || data.secondary_archetype) + '.';
    }

    $('#result-mirror').innerHTML = (copy && (copy.mirror_back || copy.mirror)) || '';

    // Health meter: average of hormone scores
    var scores = data.hormone_scores || {};
    var keys = ['testosterone','cortisol','insulin','gh'];
    // Fallback to 7-axis if backend still returns full set
    if (!scores.testosterone && scores.estrogen) keys = ['cortisol','ghrelin','insulin','leptin','testosterone','estrogen','progesterone'];
    var sum = 0, count = 0;
    keys.forEach(function(k){
      var v = Number(scores[k]);
      if (!isNaN(v)){ sum += v; count++; }
    });
    var avg = count > 0 ? sum / count : 0;
    var fillEl = $('#health-meter-fill');
    if (fillEl){
      var pct = Math.max(0, Math.min(100, (avg / 10) * 100));
      requestAnimationFrame(function(){ fillEl.style.width = pct + '%'; });
    }

    var objs = (copy && copy.objections) || [];
    $('#result-objections').innerHTML = objs.map(function(o){
      return ''
        + '<div class="objection">'
        +   '<div class="objection-x">&times;</div>'
        +   '<div class="objection-text">'
        +     '<strong>' + o.title + '</strong>'
        +     o.body
        +   '</div>'
        + '</div>';
    }).join('');

    if (copy && copy.closer){
      $('#result-closer').textContent = copy.closer;
    }

    renderRadar(data.hormone_scores || {});
    initBooking(data);
  }

  // ── Radar chart: 4 axes for men (T, GH, Cortisol, Insulin) ──
  function renderRadar(scores){
    var hormones = [
      { key: 'testosterone', label: 'TESTOSTERONE' },
      { key: 'gh',           label: 'GROWTH HORMONE' },
      { key: 'cortisol',     label: 'CORTISOL' },
      { key: 'insulin',      label: 'INSULIN' }
    ];
    // Fallback: if backend returns 7-axis scores, use those
    if (!scores.gh && scores.estrogen) {
      hormones = [
        { key: 'cortisol',     label: 'CORTISOL' },
        { key: 'testosterone', label: 'TESTOSTERONE' },
        { key: 'insulin',      label: 'INSULIN' },
        { key: 'leptin',       label: 'LEPTIN' }
      ];
    }
    var n = hormones.length;
    var cx = 150, cy = 150;
    var rOuter = 100;

    function pt(angle, r){ return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) }; }
    function ptStr(angle, r){ var p = pt(angle, r); return p.x.toFixed(2) + ',' + p.y.toFixed(2); }

    var rings = [1, 0.66, 0.33];
    var ringPolys = rings.map(function(rr, i){
      var pts = [];
      for (var k = 0; k < n; k++) pts.push(ptStr((Math.PI * 2 * k) / n, rOuter * rr));
      var dash = i === 0 ? '' : ' stroke-dasharray="2 3"';
      return '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#2E3340" stroke-width="1"' + dash + '/>';
    }).join('');

    var axisLines = '';
    for (var k = 0; k < n; k++){
      var p = pt((Math.PI * 2 * k) / n, rOuter);
      axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(2) + '" y2="' + p.y.toFixed(2) + '" stroke="#2E3340" stroke-width="1"/>';
    }

    var dataPts = [];
    var dots = '';
    for (var k2 = 0; k2 < n; k2++){
      var raw = Number(scores[hormones[k2].key] || 0);
      // Invert: high disruption score → low on chart (shows hormone health, not disruption)
      var pct = Math.max(0, Math.min(1, (10 - raw) / 10));
      var rr = rOuter * Math.max(0.12, pct);
      var dp = pt((Math.PI * 2 * k2) / n, rr);
      dataPts.push(dp.x.toFixed(2) + ',' + dp.y.toFixed(2));
      dots += '<circle cx="' + dp.x.toFixed(2) + '" cy="' + dp.y.toFixed(2) + '" r="' + (k2 === 0 ? 4 : 3) + '" fill="#EE7B4A"/>';
    }

    var labels = '';
    for (var k3 = 0; k3 < n; k3++){
      var lp = pt((Math.PI * 2 * k3) / n, rOuter + 28);
      var anchor = lp.x > cx + 4 ? 'start' : (lp.x < cx - 4 ? 'end' : 'middle');
      labels += '<text x="' + lp.x.toFixed(2) + '" y="' + (lp.y + 3).toFixed(2) + '" fill="#8A8F9A" font-family="JetBrains Mono, monospace" font-size="9" text-anchor="' + anchor + '" font-weight="600" letter-spacing="0.1em">' + hormones[k3].label + '</text>';
    }

    var svg = $('#radar-svg');
    svg.innerHTML = ''
      + '<defs>'
      +   '<linearGradient id="radGrad" x1="0%" y1="0%" x2="100%" y2="100%">'
      +     '<stop offset="0%" stop-color="#EE7B4A" stop-opacity="0.3"/>'
      +     '<stop offset="100%" stop-color="#EE7B4A" stop-opacity="0.1"/>'
      +   '</linearGradient>'
      + '</defs>'
      + '<g>' + axisLines + '</g>'
      + ringPolys
      + '<polygon points="' + dataPts.join(' ') + '" fill="url(#radGrad)" stroke="#EE7B4A" stroke-width="2" stroke-linejoin="round"/>'
      + '<g>' + dots + '</g>'
      + '<g>' + labels + '</g>';
  }

  // ── Booking calendar (same as women's version) ──
  var __bookingCtx = null;

  function initBooking(resultData){
    __bookingCtx = {
      sb: window.supabase.createClient(SUPABASE_URL, ANON_KEY),
      slots: [],
      loc: 'Ipswich',
      weekOffset: 0,
      selectedDate: null,
      selectedSlotId: null,
      lead: {
        name: sessionStorage.getItem('reshape_mens_name') || '',
        email: sessionStorage.getItem('reshape_mens_email') || '',
        phone: sessionStorage.getItem('reshape_mens_phone') || ''
      }
    };

    document.querySelectorAll('.cal-loc-btn').forEach(function(b){
      b.addEventListener('click', function(){
        document.querySelectorAll('.cal-loc-btn').forEach(function(x){ x.classList.toggle('active', x === b); });
        __bookingCtx.loc = b.getAttribute('data-loc');
        __bookingCtx.selectedDate = null;
        __bookingCtx.selectedSlotId = null;
        loadSlots();
      });
    });
    $('#cal-prev').addEventListener('click', function(){
      if (__bookingCtx.weekOffset > 0){ __bookingCtx.weekOffset -= 1; renderCal(); }
    });
    $('#cal-next').addEventListener('click', function(){ __bookingCtx.weekOffset += 1; renderCal(); });
    $('#cal-confirm').addEventListener('click', confirmBooking);
    loadSlots();
  }

  function localDate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

  function loadSlots(){
    var ctx = __bookingCtx;
    var today = localDate(new Date());
    ctx.sb
      .from('booking_slots')
      .select('*')
      .eq('location', ctx.loc)
      .eq('is_active', true)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .then(function(res){
        ctx.slots = (res.data || []).filter(function(s){ return s.booked_count < s.max_attendees; });
        return applyConflictFiltering();
      }).then(function(){
        renderCal();
      });
  }

  // Hide slots that overlap busy events on conflict calendars (DB-driven with hardcoded fallback).
  function applyConflictFiltering() {
    var ctx = __bookingCtx;
    if (!ctx.slots || ctx.slots.length === 0) return Promise.resolve();
    return loadConflictCalendars(ctx).then(function(cals) {
      if (!cals || cals.length === 0) return;
      return fetchAndFilterBusy(ctx, cals);
    }).catch(function(e) {
      console.warn('Conflict-calendar filtering skipped:', e.message);
    });
  }

  function loadConflictCalendars(ctx) {
    var locFallback = {
      'Colchester': ['icloud:Colchester consults ', 'icloud:Sean'],
      'Ipswich':    ['icloud:Ipswich consults ', 'icloud:Sara ']
    };
    return ctx.sb.from('calendar_settings').select('conflict_calendars').eq('id', 'global').maybeSingle()
      .then(function(res) {
        if (res.data && Array.isArray(res.data.conflict_calendars) && res.data.conflict_calendars.length > 0) {
          return res.data.conflict_calendars;
        }
        return locFallback[ctx.loc] || [];
      }).catch(function() {
        return locFallback[ctx.loc] || [];
      });
  }

  function fetchAndFilterBusy(ctx, cals) {
    if (!cals || cals.length === 0) return Promise.resolve();
    var fromIso = new Date().toISOString();
    var lastSlot = ctx.slots[ctx.slots.length - 1];
    var toIso = new Date(lastSlot.date + 'T23:59:59').toISOString();
    return fetch(SUPABASE_URL + '/functions/v1/calendar-freebusy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY },
      body: JSON.stringify({ calendars: cals, from: fromIso, to: toIso })
    }).then(function(r){ return r.json(); }).then(function(fbData){
      if (!fbData.success || !Array.isArray(fbData.busy) || fbData.busy.length === 0) return;
      var busy = fbData.busy.map(function(w){ return { start: new Date(w.start).getTime(), end: new Date(w.end).getTime() }; });
      ctx.slots = ctx.slots.filter(function(s){
        var slotStart = new Date(s.date + 'T' + s.start_time).getTime();
        var slotEnd = new Date(s.date + 'T' + s.end_time).getTime();
        for (var i = 0; i < busy.length; i++){
          if (slotStart < busy[i].end && slotEnd > busy[i].start) return false;
        }
        return true;
      });
    }).catch(function(e){
      console.warn('Conflict-calendar filtering skipped:', e.message);
    });
  }

  function renderCal(){
    var ctx = __bookingCtx;
    var grid = $('#cal-grid');
    var monthLabel = $('#cal-month-label');
    var today = new Date(); today.setHours(0,0,0,0);
    var weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + (ctx.weekOffset * 7));
    var monthName = weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    var prev = $('#cal-prev');
    prev.classList.toggle('disabled', ctx.weekOffset <= 0);

    var dateMap = {};
    ctx.slots.forEach(function(s){ if (!dateMap[s.date]) dateMap[s.date] = []; dateMap[s.date].push(s); });
    var todayStr = localDate(today);

    grid.querySelectorAll('.cal-day').forEach(function(el){ el.remove(); });
    for (var i = 0; i < 7; i++){
      var d = new Date(weekStart); d.setDate(d.getDate() + i);
      var key = localDate(d);
      var avail = (dateMap[key] || []).length > 0 && key >= todayStr;
      var cls = 'cal-day' + (avail ? ' avail' : ' muted') + (key === ctx.selectedDate ? ' selected' : '');
      var el = document.createElement('div');
      el.className = cls;
      el.setAttribute('data-date', key);
      el.textContent = d.getDate();
      if (avail){
        el.addEventListener('click', function(){ selectDate(this.getAttribute('data-date')); });
      }
      grid.appendChild(el);
    }

    if (!ctx.selectedDate){
      $('#cal-times-label').textContent = 'Pick a date';
      $('#cal-times').innerHTML = '';
      $('#cal-confirm').disabled = true;
      $('#cal-confirm').textContent = 'Pick a time first';
    } else {
      renderTimes();
    }
  }

  function selectDate(dateStr){
    __bookingCtx.selectedDate = dateStr;
    __bookingCtx.selectedSlotId = null;
    document.querySelectorAll('.cal-day').forEach(function(d){
      d.classList.toggle('selected', d.getAttribute('data-date') === dateStr);
    });
    renderTimes();
  }

  function renderTimes(){
    var ctx = __bookingCtx;
    var slots = ctx.slots.filter(function(s){ return s.date === ctx.selectedDate; });
    // Hide slots whose start time is less than 2 hours from now (matches booking page logic)
    var minLeadMs = 2 * 60 * 60 * 1000;
    var nowMs = Date.now();
    slots = slots.filter(function(s){
      var slotStartMs = new Date(s.date + 'T' + s.start_time).getTime();
      return slotStartMs >= nowMs + minLeadMs;
    });
    var label = new Date(ctx.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    $('#cal-times-label').textContent = label + ' — available times';

    if (slots.length === 0){
      $('#cal-times').innerHTML = '<div class="cal-empty">No times available for this day</div>';
      $('#cal-confirm').disabled = true;
      return;
    }
    $('#cal-times').innerHTML = slots.map(function(s){
      var t = s.start_time.substring(0, 5);
      var sel = ctx.selectedSlotId === s.id;
      return '<button class="cal-time' + (sel ? ' selected' : '') + '" data-id="' + s.id + '">' + t + '</button>';
    }).join('');
    document.querySelectorAll('.cal-time').forEach(function(btn){
      btn.addEventListener('click', function(){
        ctx.selectedSlotId = btn.getAttribute('data-id');
        document.querySelectorAll('.cal-time').forEach(function(b){ b.classList.toggle('selected', b === btn); });
        var slot = ctx.slots.find(function(x){ return x.id === ctx.selectedSlotId; });
        var when = label + ' · ' + slot.start_time.substring(0, 5);
        $('#cal-confirm').disabled = false;
        $('#cal-confirm').textContent = 'Confirm — ' + when;
      });
    });
  }

  var _bookingInFlight = false;
  async function confirmBooking(){
    var ctx = __bookingCtx;
    if (!ctx.selectedSlotId || _bookingInFlight) return;
    var slot = ctx.slots.find(function(x){ return x.id === ctx.selectedSlotId; });
    if (!slot) return;

    if (!ctx.lead.email || !ctx.lead.phone){
      window.location.href = '/booking/';
      return;
    }
    _bookingInFlight = true;
    var btn = $('#cal-confirm');
    btn.disabled = true; btn.textContent = 'Checking…';

    var firstName = (ctx.lead.name || '').split(' ')[0] || ctx.lead.name || '';
    var lastName = (ctx.lead.name || '').split(' ').slice(1).join(' ') || '-';
    var phone = ctx.lead.phone || null;

    // Block duplicate booking — check for existing future consult
    try {
      var today = new Date().toISOString().slice(0,10);
      var dupRes = await ctx.sb.from('bookings')
        .select('id, confirm_token, booking_slots(date, start_time, end_time), location')
        .eq('email', ctx.lead.email.toLowerCase()).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      var dup = dupRes && dupRes.data;
      if (dup && dup.booking_slots && dup.booking_slots.date >= today) {
        var dSlot = dup.booking_slots;
        var dDate = new Date(dSlot.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
        var dTime = dSlot.start_time ? dSlot.start_time.substring(0,5) : '';
        btn.textContent = 'Already booked';
        $('#cal-times-label').textContent = "You're already booked for " + dDate + ' at ' + dTime + ' in ' + (dup.location || '') + '.';
        $('#cal-times').innerHTML = '<div style="text-align:center;margin-top:12px"><a href="/booking/?reschedule=' + dup.id + '&token=' + (dup.confirm_token||'') + '" style="color:#ED5C25;font-weight:700;font-size:14px">Need to reschedule? Click here →</a></div>';
        _bookingInFlight = false;
        return;
      }
    } catch(e) { /* proceed if check fails */ }

    btn.textContent = 'Booking...';
    var __bookRow = {};
    ctx.sb.from('booking_slots').select('booked_count, max_attendees').eq('id', ctx.selectedSlotId).single().then(function(freshRes){
      var fresh = freshRes && freshRes.data;
      if (fresh && fresh.booked_count >= fresh.max_attendees) {
        btn.disabled = false; btn.textContent = 'Pick a time first'; btn.disabled = true;
        alert('Sorry, this slot was just taken. Please pick another time.');
        loadSlots();
        throw new Error('__slot_taken__');
      }
      var freshCount = (fresh && fresh.booked_count) || 0;
      return ctx.sb.from('bookings').insert([{
        slot_id: ctx.selectedSlotId,
        first_name: firstName,
        last_name: lastName,
        email: ctx.lead.email,
        phone: phone,
        location: ctx.loc,
        assessment_session_id: getSessionId()
      }]).select('id, confirm_token').single().then(function(res){
        __bookRow = (res && res.data) || {};
        return ctx.sb.from('booking_slots').update({ booked_count: freshCount + 1 }).eq('id', slot.id);
      });
    }).then(function(){
      btn.textContent = "\u2713 You're booked";
      var when = new Date(ctx.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      $('#cal-times-label').textContent = "We'll see you on " + when + ' at ' + slot.start_time.substring(0,5) + '.';
      $('#cal-times').innerHTML = '';

      if (typeof queueSequence === 'function'){
        queueSequence('booking_confirmed', {
          first_name: firstName, last_name: lastName, email: ctx.lead.email, phone: phone
        }, {
          id: __bookRow.id, confirm_token: __bookRow.confirm_token,
          date: when, time: slot.start_time.substring(0,5), location: ctx.loc,
          datetime: ctx.selectedDate + 'T' + slot.start_time.substring(0,5) + ':00'
        }, ctx.sb);
      }
    }).catch(function(e){
      _bookingInFlight = false;
      if (e && e.message === '__slot_taken__') return;
      btn.disabled = false; btn.textContent = 'Try again';
      alert('Booking failed: ' + (e && e.message ? e.message : 'unknown'));
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    var sid = getSessionId();
    if (!sid){ showError('No session id in the URL. Please retake the assessment.'); return; }
    fetchResult(sid).then(renderResult).catch(function(e){
      showError((e && e.message) ? e.message : 'Could not load your pattern.');
    });
  });
})();
