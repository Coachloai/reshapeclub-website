/* ReShape Hormonal Assessment — quiz controller.
   Renders Q1–Q14 into the .assess-question card structure from the
   approved reference. Posts each answer to the assessment-session
   Edge Function. No scoring or archetype logic in the browser.
*/
(function(){
  var SUPABASE_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var SESSION_FN   = SUPABASE_URL + '/functions/v1/assessment-session';
  var SCORE_FN     = SUPABASE_URL + '/functions/v1/score-assessment';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

  var SESSION_KEY = 'reshape_hormonal_session_v1';
  var ANSWERS_KEY = 'reshape_hormonal_answers_v1';

  var state = {
    sessionId: null,
    answers: {},
    queueIdx: 0,
    displayQuestions: [],
    emailCaptured: false,
    pickedMulti: []
  };

  function $(s, root){ return (root || document).querySelector(s); }
  function utm(name){ try { return new URLSearchParams(window.location.search).get(name); } catch(e){ return null; } }

  function fetchEdge(url, payload){
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ANON_KEY,
        'apikey': ANON_KEY
      },
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json().then(function(j){ return { status: r.status, body: j }; }); });
  }

  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  function progressUpdate(){
    var done = state.queueIdx;
    var total = state.displayQuestions.length || 15;
    var pct = Math.min(100, Math.round((done / total) * 100));
    var fill = $('#bar-fill');
    if (fill) fill.style.width = pct + '%';
    var text = $('#progress-text');
    if (text){
      var qNum = Math.min(state.queueIdx + 1, total);
      var minsLeft = Math.max(1, Math.ceil((total - done) * 0.18));
      text.innerHTML = '<strong>Question ' + qNum + '</strong> of ' + total + ' · about ' + minsLeft + ' min remaining';
    }
  }

  function buildQueue(){
    state.displayQuestions = window.RESHAPE_QUESTIONS.filter(function(q){
      if (typeof q.skipIf === 'function' && q.skipIf(state.answers)){
        if (q.skipValue && !state.answers[q.id]){
          state.answers[q.id] = q.skipValue;
          sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(state.answers));
          fetchEdge(SESSION_FN, { action: 'submit_answer', session_id: state.sessionId, question_id: q.id, answer_value: q.skipValue });
        }
        return false;
      }
      return true;
    });
    state.queueIdx = 0;
    for (var i = 0; i < state.displayQuestions.length; i++){
      if (!state.answers[state.displayQuestions[i].id]) { state.queueIdx = i; break; }
      state.queueIdx = i + 1;
    }
  }

  function renderQuestion(){
    progressUpdate();
    var q = state.displayQuestions[state.queueIdx];
    if (!q) { return submitFinal(); }

    // Email gate fires the moment we move past the gate question.
    var gateIdx = state.displayQuestions.findIndex(function(qq){ return qq.id === window.RESHAPE_GATE_AFTER; });
    if (!state.emailCaptured && state.queueIdx > gateIdx) {
      return renderGate();
    }

    var idx = state.queueIdx + 1;
    var total = state.displayQuestions.length;
    var existing = state.answers[q.id];
    var multiSel = (q.type === 'multi' && existing) ? existing.split(',') : [];
    state.pickedMulti = multiSel.slice();

    var optsHtml = q.options.map(function(opt){
      var isSel = q.type === 'multi'
        ? multiSel.indexOf(opt.value) > -1
        : existing === opt.value;
      return ''
        + '<button class="q-opt' + (isSel ? ' selected' : '') + '" data-value="' + opt.value + '">'
        +   '<div class="q-opt-marker' + (q.type === 'multi' ? ' square' : '') + '"></div>'
        +   '<div>'
        +     '<div class="q-opt-title">' + opt.label + '</div>'
        +     (opt.sub ? '<div class="q-opt-sub">' + opt.sub + '</div>' : '')
        +   '</div>'
        + '</button>';
    }).join('');

    var hasSelection = q.type === 'multi' ? multiSel.length > 0 : !!existing;
    var html = ''
      + '<div class="assess-question">'
      +   '<div class="q-counter">' + pad(idx) + ' / ' + pad(total) + ' · ' + (q.category || '') + '</div>'
      +   '<h2 class="q-title">' + q.text + '</h2>'
      +   (q.why ? '<p class="q-why">' + q.why + '</p>' : '')
      +   '<div class="q-options">' + optsHtml + '</div>'
      +   '<div class="q-nav">'
      +     (state.queueIdx > 0
              ? '<button class="q-back" id="q-back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Back</button>'
              : '<span></span>')
      +     '<button class="q-next" id="q-next-btn"' + (hasSelection ? '' : ' disabled') + '>'
      +       'Continue'
      +       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      +     '</button>'
      +   '</div>'
      + '</div>';

    var root = $('#screen-root');
    root.innerHTML = html;

    var sec = root.querySelector('.assess-question');
    sec.querySelectorAll('.q-opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        if (q.type === 'multi'){
          btn.classList.toggle('selected');
          var v = btn.getAttribute('data-value');
          var ix = state.pickedMulti.indexOf(v);
          if (ix > -1) state.pickedMulti.splice(ix, 1); else state.pickedMulti.push(v);
          $('#q-next-btn').disabled = state.pickedMulti.length === 0;
        } else {
          sec.querySelectorAll('.q-opt').forEach(function(o){ o.classList.remove('selected'); });
          btn.classList.add('selected');
          $('#q-next-btn').disabled = false;
        }
      });
    });
    var nextBtn = $('#q-next-btn');
    nextBtn.addEventListener('click', function(){
      var value;
      if (q.type === 'multi'){
        if (state.pickedMulti.length === 0) return;
        value = state.pickedMulti.join(',');
      } else {
        var sel = sec.querySelector('.q-opt.selected');
        if (!sel) return;
        value = sel.getAttribute('data-value');
      }
      state.answers[q.id] = value;
      sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(state.answers));
      fetchEdge(SESSION_FN, { action: 'submit_answer', session_id: state.sessionId, question_id: q.id, answer_value: value });
      state.queueIdx += 1;
      renderQuestion();
    });
    var backBtn = $('#q-back-btn');
    if (backBtn) backBtn.addEventListener('click', function(){
      state.queueIdx = Math.max(0, state.queueIdx - 1);
      renderQuestion();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderGate(){
    progressUpdate();
    var html = ''
      + '<div class="assess-question" style="max-width:560px">'
      +   '<div class="gate">'
      +     '<div class="gate-icon">✦</div>'
      +     '<h3>Where should we send your full pattern report?</h3>'
      +     "<p>You're 40% through. We'll email your archetype reveal, the protocol guidance, and your free strategy-call link the moment you finish.</p>"
      +     '<div class="gate-fields">'
      +       '<input type="text" id="gate-name" placeholder="First name" autocomplete="given-name">'
      +       '<input type="email" id="gate-email" placeholder="you@example.com" autocomplete="email">'
      +       '<input type="tel" id="gate-phone" placeholder="07700 000000" autocomplete="tel">'
      +     '</div>'
      +     '<button class="cal-confirm" id="gate-submit" style="background:var(--terracotta)">Continue</button>'
      +     '<label class="gate-consent"><input type="checkbox" id="gate-consent" checked><span>I\'d like Coach Jaime to send me my pattern report and follow-up emails. Unsubscribe anytime.</span></label>'
      +     '<div class="gate-error" id="gate-error"></div>'
      +     '<div class="gate-disclaimer">We never share your data. Encrypted in transit and at rest.</div>'
      +   '</div>'
      + '</div>';

    var root = $('#screen-root');
    root.innerHTML = html;

    // Pre-fill if the user is resuming a session.
    var savedName  = sessionStorage.getItem('reshape_hormonal_name');
    var savedEmail = sessionStorage.getItem('reshape_hormonal_email');
    var savedPhone = sessionStorage.getItem('reshape_hormonal_phone');
    if (savedName)  $('#gate-name').value  = savedName;
    if (savedEmail) $('#gate-email').value = savedEmail;
    if (savedPhone) $('#gate-phone').value = savedPhone;

    $('#gate-submit').addEventListener('click', function(){
      var name = ($('#gate-name').value || '').trim();
      var email = ($('#gate-email').value || '').trim().toLowerCase();
      var phoneRaw = ($('#gate-phone').value || '').trim();
      var phoneCleaned = phoneRaw.replace(/[\s\-\(\)]/g, '');
      var consent = $('#gate-consent').checked;
      var err = $('#gate-error');
      err.textContent = '';
      if (!name) return err.textContent = 'Please enter your first name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err.textContent = 'Please enter a valid email address.';
      if (!phoneCleaned || !/^(\+\d{10,15}|0[1-9]\d{8,10}|44\d{10,11})$/.test(phoneCleaned)) {
        return err.textContent = 'Please enter a valid phone number (e.g. 07700 000000).';
      }
      if (!consent) return err.textContent = 'Please tick the consent box to continue.';

      var btn = $('#gate-submit');
      btn.disabled = true; btn.textContent = 'Sending…';
      fetchEdge(SESSION_FN, {
        action: 'capture_email',
        session_id: state.sessionId,
        name: name, email: email, phone: phoneCleaned, consent_marketing: consent
      }).then(function(r){
        btn.disabled = false; btn.textContent = 'Continue';
        if (r.status !== 200){
          err.textContent = (r.body && r.body.error) ? r.body.error : 'Something went wrong. Please try again.';
          return;
        }
        state.emailCaptured = true;
        sessionStorage.setItem('reshape_hormonal_email', email);
        sessionStorage.setItem('reshape_hormonal_name', name);
        sessionStorage.setItem('reshape_hormonal_phone', phoneCleaned);
        renderQuestion();
      }).catch(function(){
        btn.disabled = false; btn.textContent = 'Continue';
        err.textContent = 'Network error. Please try again.';
      });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitFinal(){
    var root = $('#screen-root');
    root.innerHTML = ''
      + '<div class="loading-state">'
      +   '<div class="loading-spinner"></div>'
      +   '<h3>Reading your pattern…</h3>'
      +   '<p>Cross-checking your answers across 7 hormone signals.</p>'
      + '</div>';

    fetchEdge(SCORE_FN, { session_id: state.sessionId }).then(function(r){
      if (r.status !== 200){
        var errBody = r.body || {};
        if (errBody.error === 'incomplete'){
          alert('Some answers are missing — let me take you back.');
          buildQueue();
          renderQuestion();
          return;
        }
        alert(errBody.error || 'Something went wrong. Please try again.');
        return;
      }
      try { sessionStorage.setItem('reshape_hormonal_result_' + state.sessionId, JSON.stringify(r.body)); } catch(e){}
      window.location.href = './result.html?session_id=' + encodeURIComponent(state.sessionId);
    }).catch(function(){
      alert('Network error. Please try again.');
    });
  }

  function start(){
    var resume = utm('resume') || sessionStorage.getItem(SESSION_KEY);
    if (resume){
      state.sessionId = resume;
      sessionStorage.setItem(SESSION_KEY, resume);
      var saved = sessionStorage.getItem(ANSWERS_KEY);
      if (saved) { try { state.answers = JSON.parse(saved) || {}; } catch(e){} }
      var savedEmail = sessionStorage.getItem('reshape_hormonal_email');
      if (savedEmail) state.emailCaptured = true;
      buildQueue();
      renderQuestion();
      return;
    }

    fetchEdge(SESSION_FN, {
      action: 'start',
      utm_source: utm('utm_source'),
      utm_campaign: utm('utm_campaign')
    }).then(function(r){
      if (r.status !== 200 || !r.body.session_id){
        $('#screen-root').innerHTML = ''
          + '<div class="loading-state">'
          +   '<h3>Could not start the assessment</h3>'
          +   '<p>Please refresh and try again.</p>'
          + '</div>';
        return;
      }
      state.sessionId = r.body.session_id;
      sessionStorage.setItem(SESSION_KEY, state.sessionId);
      buildQueue();
      renderQuestion();
    }).catch(function(){
      $('#screen-root').innerHTML = ''
        + '<div class="loading-state">'
        +   '<h3>Could not start the assessment</h3>'
        +   '<p>Please refresh and try again.</p>'
        + '</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', start);
})();
