/* Result page renderer.
   Calls score-assessment exactly once per session_id, then renders the
   archetype reveal, readout, objections, radar chart, and a real booking
   calendar — all in the approved reference design.
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

  // ── Archetype copy. Pass 4 will move this into the Edge Function
  //    so the browser never sees it. For now it lives here so the
  //    page renders end-to-end while the function returns the stub.
  var ARCHETYPE_COPY = {
    stress_driven_plateau: {
      headline: "You're a Stress-Driven Plateau.",
      mirror: "<p>Based on what you shared, your weight is settling around your <strong>midsection</strong>, you're waking in the night with a busy mind, and your cravings hit hardest in the <strong>afternoon</strong>. That's not a coincidence — it's a textbook cortisol signature.</p><p>What's likely happening: chronic stress is keeping your cortisol elevated, which raises blood sugar, drives belly storage, disrupts your sleep architecture, and triggers afternoon sugar-seeking. Your body isn't broken. It's doing exactly what it's been signalled to do.</p>",
      objections: [
        { title: "Calorie cutting made it worse", body: "Restriction is itself a stressor. For a cortisol-driven body, eating less raises cortisol further — your body holds onto fat harder." },
        { title: "HIIT and intense cardio backfired", body: "High-intensity training spikes cortisol. In your pattern, you need strength work plus walking — not more sweat sessions." },
        { title: "\"Eat less, move more\" ignored your sleep", body: "Your night wake-ups are doing more damage than your snack drawer. Sleep repair is the first lever in your protocol." }
      ]
    },
    hormonal_shift: {
      headline: "You're a Hormonal Shift Pattern.",
      mirror: "<p>Based on what you shared, your <strong>cycle has changed</strong> (or stopped), your <strong>fat distribution is shifting</strong>, and the protocols that worked at 30 are stalling now. Your body is doing real work — recalibrating hormones it has produced for decades.</p><p>What's likely happening: estrogen, progesterone, and testosterone are shifting — sometimes in opposite directions at the same time. The fat-distribution rules change, the muscle-building rules change, and the protocols that worked at 30 stop working at 42. This is not failure. This is biology.</p>",
      objections: [
        { title: "Same calories, different result", body: "Your body literally processes fuel differently now. The number didn't change — the rules did." },
        { title: "Cardio-first wasn't enough", body: "Muscle is the new currency. Strength training is non-negotiable in this pattern, regardless of how foreign that feels." },
        { title: "You weren't told this would happen", body: "Most women aren't. The hormonal shift starts up to 10 years before menopause — and most weight-loss advice ignores it entirely." }
      ]
    },
    metabolic_resistance: {
      headline: "You're a Metabolic Resistance Pattern.",
      mirror: "<p>Based on what you shared, you've <strong>lost weight before and either plateaued hard or regained more</strong>, your <strong>energy crashes after meals</strong>, and exercise barely moves the needle anymore. Your body has stopped responding to the signals it should. That's the metabolic resistance signature.</p><p>What's likely happening: insulin and leptin — the hormones that should tell your body to burn fat and feel full — have stopped being heard. Your cells are resistant. The result is a body that holds onto fat aggressively, cycles between hunger and crash, and refuses to release weight no matter what you cut.</p>",
      objections: [
        { title: "Calorie deficits stopped working", body: "Once leptin is dysregulated, eating less makes you hungrier and slower, not leaner. The lever isn't smaller — it's different." },
        { title: "Carb cuts gave temporary wins", body: "Going low-carb often works for 4-6 weeks then plateaus. That's not failure — that's resistance reasserting." },
        { title: "\"Just be patient\" was bad advice", body: "Patience without changing the signalling pattern is just slower failure. The protocol shift comes first." }
      ]
    },
    compound_pattern: {
      headline: "You're a Compound Pattern.",
      mirror: "<p>Based on what you shared, your symptoms span <strong>all three patterns</strong> — stress signalling, hormonal shift, and metabolic resistance are all showing up. About 1 in 10 women score this way, and it almost always points to the same thing: you've been doing the right things in the wrong order.</p><p>What's likely happening: when patterns compound, the order of intervention matters more than the intensity. Treat all three at once and nothing moves. Treat them in the right sequence — usually stress first, then metabolic, then hormonal — and the body unlocks one layer at a time.</p>",
      objections: [
        { title: "Multi-front protocols failed", body: "When you tried to fix everything at once, nothing held. That's the compound trap, not your fault." },
        { title: "Generic plans treat the symptom you notice most", body: "Your pattern needs sequencing, not a single tactic." },
        { title: "You probably need bloodwork", body: "This is the one pattern where I'll likely recommend a panel before we set the plan." }
      ]
    }
  };

  var ARCHETYPE_LABEL = {
    stress_driven_plateau: 'Stress-Driven Plateau',
    hormonal_shift:        'Hormonal Shift Pattern',
    metabolic_resistance:  'Metabolic Resistance Pattern',
    compound_pattern:      'Compound Pattern'
  };

  // ── Fetch with caching ──
  function fetchResult(sid){
    var cacheKey = 'reshape_hormonal_result_' + sid;
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

  // ── Render archetype reveal + readout + objections ──
  function renderResult(data){
    $('#loading-state').style.display = 'none';
    $('#result-state').style.display = 'block';

    var primary   = data.primary_archetype;
    // Server returns the assembled readout. Old cached sessions may still
    // come back with { stub: true } — fall back to the static archetype
    // scripts so the page still renders rather than blanking out.
    var serverReadout = (data.readout && !data.readout.stub) ? data.readout : null;
    var copy          = serverReadout || ARCHETYPE_COPY[primary];
    var label         = ARCHETYPE_LABEL[primary];

    var headline  = (copy && copy.headline) || ("You're a " + label + ".");
    // Wrap the archetype name in <em> for the italic terracotta accent.
    var headlineHtml = headline.replace(label, '<em>' + label + '</em>');
    $('#result-headline').innerHTML = headlineHtml;

    // Secondary line. Server-built readout puts the full sentence in
    // copy.secondary; fall back to deriving it from secondary_archetype.
    if (copy && copy.secondary){
      $('#result-secondary').textContent = copy.secondary;
    } else if (data.secondary_archetype && data.secondary_archetype !== primary){
      $('#result-secondary').textContent = 'With notable signals from the ' + ARCHETYPE_LABEL[data.secondary_archetype] + '.';
    }

    $('#result-mirror').innerHTML = (copy && (copy.mirror_back || copy.mirror)) || '';

    var objs = (copy && copy.objections) || [];
    $('#result-objections').innerHTML = objs.map(function(o){
      return ''
        + '<div class="objection">'
        +   '<div class="objection-x">✕</div>'
        +   '<div class="objection-text">'
        +     '<strong>' + o.title + '</strong>'
        +     o.body
        +   '</div>'
        + '</div>';
    }).join('');

    // Q14-driven 1-liner above the booking block (only set on server readouts).
    if (copy && copy.closer){
      $('#result-closer').textContent = copy.closer;
    }

    renderRadar(data.hormone_scores || {});
    initBooking(data);
  }

  // ── Radar chart. Heptagon with 7 hormone axes, scores 0–10 → radius. ──
  function renderRadar(scores){
    var hormones = [
      { key: 'cortisol',     label: 'CORTISOL' },
      { key: 'ghrelin',      label: 'GHRELIN' },
      { key: 'insulin',      label: 'INSULIN' },
      { key: 'leptin',       label: 'LEPTIN' },
      { key: 'testosterone', label: 'TESTOST.' },
      { key: 'estrogen',     label: 'ESTROGEN' },
      { key: 'progesterone', label: 'PROGEST.' }
    ];
    var n = hormones.length;
    var cx = 170, cy = 170;
    var rOuter = 110;

    function pt(angle, r){
      return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
    }
    function ptStr(angle, r){
      var p = pt(angle, r); return p.x.toFixed(2) + ',' + p.y.toFixed(2);
    }

    var rings = [1, 0.66, 0.33];
    var ringPolys = rings.map(function(rr, i){
      var pts = [];
      for (var k = 0; k < n; k++) pts.push(ptStr((Math.PI * 2 * k) / n, rOuter * rr));
      var dash = i === 0 ? '' : ' stroke-dasharray="2 3"';
      return '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#E5DFD5" stroke-width="1"' + dash + '/>';
    }).join('');

    var axisLines = '';
    for (var k = 0; k < n; k++){
      var p = pt((Math.PI * 2 * k) / n, rOuter);
      axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(2) + '" y2="' + p.y.toFixed(2) + '" stroke="#E5DFD5" stroke-width="1"/>';
    }

    var dataPts = [];
    var dots = '';
    for (var k2 = 0; k2 < n; k2++){
      var raw = Number(scores[hormones[k2].key] || 0);
      var pct = Math.max(0, Math.min(1, raw / 10));
      // Floor at ~0.10 of the outer ring so a "0" still draws something.
      var rr = rOuter * Math.max(0.10, pct);
      var dp = pt((Math.PI * 2 * k2) / n, rr);
      dataPts.push(dp.x.toFixed(2) + ',' + dp.y.toFixed(2));
      dots += '<circle cx="' + dp.x.toFixed(2) + '" cy="' + dp.y.toFixed(2) + '" r="' + (k2 === 0 ? 4 : 3) + '" fill="#C8674A"/>';
    }

    var labels = '';
    for (var k3 = 0; k3 < n; k3++){
      var lp = pt((Math.PI * 2 * k3) / n, rOuter + 30);
      var anchor = lp.x > cx + 4 ? 'start' : (lp.x < cx - 4 ? 'end' : 'middle');
      labels += '<text x="' + lp.x.toFixed(2) + '" y="' + (lp.y + 3).toFixed(2) + '" fill="#5A5550" font-family="Inter, sans-serif" font-size="10" text-anchor="' + anchor + '" font-weight="500" letter-spacing="0.08em">' + hormones[k3].label + '</text>';
    }

    var svg = $('#radar-svg');
    svg.innerHTML = ''
      + '<defs>'
      +   '<linearGradient id="radGrad" x1="0%" y1="0%" x2="100%" y2="100%">'
      +     '<stop offset="0%" stop-color="#C8674A" stop-opacity="0.35"/>'
      +     '<stop offset="100%" stop-color="#C8674A" stop-opacity="0.18"/>'
      +   '</linearGradient>'
      + '</defs>'
      + '<g>' + axisLines + '</g>'
      + ringPolys
      + '<polygon points="' + dataPts.join(' ') + '" fill="url(#radGrad)" stroke="#C8674A" stroke-width="2" stroke-linejoin="round"/>'
      + '<g>' + dots + '</g>'
      + '<g>' + labels + '</g>';
  }

  // ── Booking calendar (real Supabase data, reference styling) ──
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
        name: sessionStorage.getItem('reshape_hormonal_name') || '',
        email: sessionStorage.getItem('reshape_hormonal_email') || ''
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
        renderCal();
      });
  }

  function renderCal(){
    var ctx = __bookingCtx;
    var grid = $('#cal-grid');
    var monthLabel = $('#cal-month-label');
    var today = new Date(); today.setHours(0,0,0,0);
    var weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + (ctx.weekOffset * 7));
    var weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);

    var monthName = weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    var prev = $('#cal-prev');
    prev.classList.toggle('disabled', ctx.weekOffset <= 0);

    var dateMap = {};
    ctx.slots.forEach(function(s){ if (!dateMap[s.date]) dateMap[s.date] = []; dateMap[s.date].push(s); });
    var todayStr = localDate(today);

    // Reset day cells (keep header row)
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

  function confirmBooking(){
    var ctx = __bookingCtx;
    if (!ctx.selectedSlotId) return;
    var slot = ctx.slots.find(function(x){ return x.id === ctx.selectedSlotId; });
    if (!slot) return;

    if (!ctx.lead.email){
      // Fall back to the standalone /booking/ page so we collect contact details there.
      window.location.href = '/booking/';
      return;
    }
    var btn = $('#cal-confirm');
    btn.disabled = true; btn.textContent = 'Booking…';

    var firstName = (ctx.lead.name || '').split(' ')[0] || ctx.lead.name || '';
    var lastName = (ctx.lead.name || '').split(' ').slice(1).join(' ') || '-';

    ctx.sb.from('bookings').insert([{
      slot_id: ctx.selectedSlotId,
      first_name: firstName,
      last_name: lastName,
      email: ctx.lead.email,
      phone: null,
      location: ctx.loc
    }]).then(function(){
      return ctx.sb.from('booking_slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slot.id);
    }).then(function(){
      btn.textContent = "✓ You're booked";
      var when = new Date(ctx.selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      $('#cal-times-label').textContent = "We'll see you on " + when + ' at ' + slot.start_time.substring(0,5) + '.';
      $('#cal-times').innerHTML = '';

      // Queue booking_confirmed sequence via the existing browser helper.
      if (typeof queueSequence === 'function'){
        queueSequence('booking_confirmed', {
          first_name: firstName, last_name: lastName, email: ctx.lead.email, phone: null
        }, {
          date: when, time: slot.start_time.substring(0,5), location: ctx.loc,
          datetime: ctx.selectedDate + 'T' + slot.start_time.substring(0,5) + ':00'
        }, ctx.sb);
      }
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Try again';
      alert('Booking failed: ' + (e && e.message ? e.message : 'unknown'));
    });
  }

  // ── INIT ──
  document.addEventListener('DOMContentLoaded', function(){
    var sid = getSessionId();
    if (!sid){ showError('No session id in the URL. Please retake the assessment.'); return; }
    fetchResult(sid).then(renderResult).catch(function(e){
      showError((e && e.message) ? e.message : 'Could not load your pattern.');
    });
  });
})();
