/* Consult-confirm page renderer.
   Loads booking + assessment + pattern-matched gallery, captures
   ticked members + note, posts to consult-confirm Edge Function.
*/
(function(){
  var SUPABASE_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';
  var CONFIRM_FN   = SUPABASE_URL + '/functions/v1/consult-confirm';

  var DEFAULT_PATTERN_F = 'stress_driven_plateau';
  var DEFAULT_PATTERN_M = 'cortisol_dominant_decline';

  var state = {
    bookingId: null,
    confirmToken: null,
    booking: null,
    assessment: null,
    leadGender: null,
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

  // Load booking + slot + lead gender (for gallery fallback).
  function loadBooking(sb){
    return sb.from('bookings')
      .select('id, confirm_token, confirmed_at, first_name, last_name, email, location, assessment_session_id, slot_id, lead_id, booking_slots(date, start_time, end_time, location)')
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
      })
      .then(function(b){
        if (!b.lead_id) return b;
        return sb.from('leads').select('gender').eq('id', b.lead_id).maybeSingle()
          .then(function(r){ state.leadGender = (r.data && r.data.gender) || null; return b; })
          .catch(function(){ return b; });
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
    var fallback = (state.leadGender === 'Male') ? DEFAULT_PATTERN_M : DEFAULT_PATTERN_F;
    var pattern = (state.assessment && state.assessment.primary_archetype) || fallback;
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

  // Preview mode — lets us view the page without a real booking row.
  // Usage: ?preview=1 (form state) or ?preview=success (success state).
  function mockBooking(){
    var d = new Date();
    d.setDate(d.getDate() + 5);
    return {
      id: 'preview',
      confirm_token: 'preview',
      confirmed_at: null,
      first_name: 'Sarah',
      last_name: 'Example',
      email: 'sarah@example.com',
      location: 'Ipswich',
      assessment_session_id: null,
      slot_id: null,
      booking_slots: {
        date: d.toISOString().slice(0, 10),
        start_time: '10:30:00',
        end_time: '11:30:00',
        location: 'Ipswich'
      }
    };
  }
  function mockMembers(){
    var IMG = 'https://lvizldmdficsfpgegehp.supabase.co/storage/v1/object/public/images/ba-women';
    return [
      { id:'m1', name:'Abbey', image_url:IMG+'/Abbey.png',
        starting_point:"Carrying belly weight that wouldn't shift despite training regularly",
        goal:'Lose the stubborn midsection weight, feel strong again' },
      { id:'m2', name:'Stacey', image_url:IMG+'/Stacey.png',
        starting_point:'Stress-driven weight gain, exhausted by 3pm every day',
        goal:'Get her energy back, drop a dress size' },
      { id:'m3', name:'Lisa', image_url:IMG+'/Lisa.png',
        starting_point:'High-pressure job, weight creeping up despite eating less',
        goal:'Reshape around her stress, not against it' },
      { id:'m4', name:'Shelley', image_url:IMG+'/Shelley.png',
        starting_point:'Same routine, different body — nothing worked after 50',
        goal:'Find the version of training that works at her age' },
      { id:'m5', name:'Claire', image_url:IMG+'/Claire.png',
        starting_point:'Perimenopause symptoms, gaining weight around the middle',
        goal:'Balance hormones naturally, build lean muscle' },
      { id:'m6', name:'Barbara', image_url:IMG+'/Barbara.png',
        starting_point:'Lifelong active but suddenly stuck, energy crashes after meals',
        goal:'Work with her body\'s changes, not against them' },
      { id:'m7', name:'Jaime', image_url:IMG+'/Jaime.png',
        starting_point:'Lost weight three times, regained it three times',
        goal:'Break the yo-yo cycle for good' },
      { id:'m8', name:'Nicole', image_url:IMG+'/Nicole.png',
        starting_point:'Told her metabolism was broken, nothing seemed to work',
        goal:'A plan that finally responded to her body' },
      { id:'m9', name:'Becky', image_url:IMG+'/Becky.png',
        starting_point:'Plateaued for over a year despite calorie counting',
        goal:'Get her metabolism responding again, feel like herself' },
      { id:'m10', name:'Gloria', image_url:IMG+'/Gloria.png',
        starting_point:'Multiple symptoms — stress, poor sleep, cravings, bloating',
        goal:'Find out what her body actually needs' },
      { id:'m11', name:'Rose', image_url:IMG+'/Rose.png',
        starting_point:'Tried every diet going, conflicting advice from three programmes',
        goal:'One coherent protocol that holds' },
      { id:'m12', name:'Kimberlee', image_url:IMG+'/Kimberlee.png',
        starting_point:'Emotional eating, poor sleep, constantly inflamed',
        goal:'Calm the inflammation, build a sustainable routine' }
    ];
  }
  function runPreview(mode){
    state.bookingId = 'preview';
    state.confirmToken = 'preview';
    state.booking = mockBooking();
    var sb = buildClient();
    Promise.resolve().then(function(){
      state.members = mockMembers();
      renderHero();
      renderGallery();
      $('#submit-btn').addEventListener('click', function(){
        show('state-success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      $('#reschedule-btn').addEventListener('click', function(){
        alert('Reschedule (preview mode — no redirect).');
      });
      if (mode === 'success'){
        show('state-success');
      } else {
        show('state-form');
      }
    });
  }

  // ── INIT ──
  document.addEventListener('DOMContentLoaded', function(){
    var qs = new URLSearchParams(window.location.search);
    var preview = qs.get('preview');
    if (preview){
      runPreview(preview);
      return;
    }

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
