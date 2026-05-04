/* Consult-confirm page renderer.
   Loads booking + assessment + pattern-matched gallery, captures
   ticked members + note, posts to consult-confirm Edge Function.
*/
(function(){
  var SUPABASE_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';
  var CONFIRM_FN   = SUPABASE_URL + '/functions/v1/consult-confirm';

  var DEFAULT_PATTERN = 'stress_driven_plateau';

  var state = {
    bookingId: null,
    confirmToken: null,
    booking: null,
    assessment: null,
    members: [],
    selected: new Set()
  };

  function $(s){ return document.querySelector(s); }
  function show(id){
    ['state-loading','state-error','state-form','state-success'].forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? '' : 'none';
    });
  }
  function showError(msg){
    show('state-error');
    if (msg) $('#error-msg').textContent = msg;
  }

  function getParams(){
    var qs = new URLSearchParams(window.location.search);
    // Accept both ?id=&token= (preferred — short URL) and ?booking_id=&confirm_token= (long).
    return {
      id:    qs.get('id')    || qs.get('booking_id'),
      token: qs.get('token') || qs.get('confirm_token')
    };
  }

  function fmtWhen(date, startTime){
    if (!date) return '';
    var d = new Date(date + 'T' + (startTime || '12:00:00'));
    var dayLabel = d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
    var time = startTime ? startTime.substring(0,5) : '';
    return time ? dayLabel + ' at ' + time : dayLabel;
  }
  function fmtShortDay(date){
    if (!date) return 'soon';
    var d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday:'long' });
  }

  function buildClient(){
    return window.supabase.createClient(SUPABASE_URL, ANON_KEY);
  }

  // Load booking + slot + (optional) assessment.
  function loadBooking(sb){
    return sb.from('bookings')
      .select('id, confirm_token, confirmed_at, first_name, last_name, email, location, assessment_session_id, slot_id, booking_slots(date, start_time, end_time, location)')
      .eq('id', state.bookingId)
      .maybeSingle()
      .then(function(res){
        if (res.error) throw new Error('Booking lookup failed.');
        var b = res.data;
        if (!b) throw new Error("We couldn't find that booking.");
        if (b.confirm_token !== state.confirmToken){
          throw new Error('That confirmation link looks invalid. If you copied it from a message, try clicking it directly.');
        }
        state.booking = b;
        return b;
      });
  }

  function loadAssessment(sb){
    if (!state.booking || !state.booking.assessment_session_id){
      return Promise.resolve(null);
    }
    return sb.from('assessments')
      .select('primary_archetype, secondary_archetype')
      .eq('session_id', state.booking.assessment_session_id)
      .maybeSingle()
      .then(function(res){
        state.assessment = res.data || null;
        return state.assessment;
      })
      .catch(function(){ state.assessment = null; return null; });
  }

  function loadGallery(sb){
    var pattern = (state.assessment && state.assessment.primary_archetype) || DEFAULT_PATTERN;
    return sb.from('transformation_members')
      .select('id, name, image_url, starting_point, goal')
      .eq('pattern_tag', pattern)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .then(function(res){
        state.members = res.data || [];
        return state.members;
      });
  }

  function renderHero(){
    var b = state.booking;
    var slot = (b && b.booking_slots) || {};
    var when = fmtWhen(slot.date, slot.start_time);
    var studio = (b.location || slot.location || '').trim();
    var coach = 'your ReShape nutritionist'; // No per-row coach assignment yet.

    if ($('#meta-coach'))  $('#meta-coach').textContent  = coach;
    if ($('#meta-when'))   $('#meta-when').textContent   = when || '—';
    if ($('#meta-studio')) $('#meta-studio').textContent = studio ? 'ReShape ' + studio : 'ReShape';
    if ($('#intro-coach')) $('#intro-coach').textContent = coach;
    if ($('#btn-day'))     $('#btn-day').textContent     = fmtShortDay(slot.date);
    if ($('#success-when')) $('#success-when').textContent = when || 'soon';
    if ($('#success-coach')) $('#success-coach').textContent = coach.charAt(0).toUpperCase() + coach.slice(1);
  }

  function renderGallery(){
    var grid = $('#gallery');
    grid.innerHTML = '';
    if (state.members.length === 0){
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-style:italic;padding:2rem">No matching profiles available right now.</p>';
      return;
    }
    state.members.forEach(function(m){
      var card = document.createElement('label');
      card.className = 'card';
      card.setAttribute('data-id', m.id);

      var img = '<img class="card-img" src="' + escapeAttr(m.image_url) + '" alt="' + escapeAttr(m.name) + '" loading="lazy">';
      var tick = '<div class="card-tick"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>';
      var body = '<div class="card-body">' +
        '<div class="card-name">' + escapeHtml(m.name) + '</div>' +
        (m.starting_point ? '<div class="card-line label">Started</div><div class="card-line">' + escapeHtml(m.starting_point) + '</div>' : '') +
        (m.goal ? '<div class="card-line label">Goal</div><div class="card-line">' + escapeHtml(m.goal) + '</div>' : '') +
      '</div>';

      card.innerHTML = '<input type="checkbox" value="' + escapeAttr(m.id) + '">' + img + tick + body;

      var input = card.querySelector('input');
      input.addEventListener('change', function(){
        if (input.checked) {
          state.selected.add(m.id);
          card.classList.add('selected');
        } else {
          state.selected.delete(m.id);
          card.classList.remove('selected');
        }
      });

      grid.appendChild(card);
    });
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s){ return escapeHtml(s); }

  function submit(){
    var btn = $('#submit-btn');
    btn.disabled = true;
    btn.textContent = 'Confirming…';

    var note = ($('#note').value || '').trim();
    var ticked = Array.from(state.selected);

    fetch(CONFIRM_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ANON_KEY,
        'apikey': ANON_KEY
      },
      body: JSON.stringify({
        booking_id: state.bookingId,
        confirm_token: state.confirmToken,
        relate_to_members: ticked,
        pre_consult_note: note
      })
    }).then(function(r){
      return r.json().then(function(j){ return { status: r.status, body: j }; });
    }).then(function(out){
      if (out.status !== 200 || !out.body || !out.body.ok){
        throw new Error((out.body && out.body.error) || 'Confirmation failed.');
      }
      show('state-success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function(e){
      btn.disabled = false;
      btn.textContent = 'Try again';
      alert(e.message || 'Could not confirm. Please try again.');
    });
  }

  function reschedule(){
    var url = '/booking/?reschedule=' + encodeURIComponent(state.bookingId) + '&token=' + encodeURIComponent(state.confirmToken);
    window.location.href = url;
  }

  // ── INIT ──
  document.addEventListener('DOMContentLoaded', function(){
    var p = getParams();
    if (!p.id || !p.token){
      showError("This confirmation link is missing some details. Check the message we sent you, or get in touch.");
      return;
    }
    state.bookingId = p.id;
    state.confirmToken = p.token;

    var sb = buildClient();
    loadBooking(sb)
      .then(function(){ return loadAssessment(sb); })
      .then(function(){ return loadGallery(sb); })
      .then(function(){
        renderHero();
        renderGallery();
        $('#submit-btn').addEventListener('click', submit);
        $('#reschedule-btn').addEventListener('click', reschedule);
        // If already confirmed, drop straight into success.
        if (state.booking && state.booking.confirmed_at){
          show('state-success');
        } else {
          show('state-form');
        }
      })
      .catch(function(e){
        showError(e && e.message ? e.message : 'Could not load your booking.');
      });
  });
})();
