/* ReShape Men's Performance Assessment — quiz controller.
   Renders Q1–Q12 with icons, auto-advance on single-select,
   segmented progress bar. Posts each answer to the assessment-session
   Edge Function. Same backend as the women's assessment.
*/
(function(){
  var SUPABASE_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var SESSION_FN   = SUPABASE_URL + '/functions/v1/assessment-session';
  var SCORE_FN     = SUPABASE_URL + '/functions/v1/score-assessment';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

  var SESSION_KEY = 'reshape_mens_session_v1';
  var ANSWERS_KEY = 'reshape_mens_answers_v1';

  var state = {
    sessionId: null,
    answers: {},
    queueIdx: 0,
    displayQuestions: [],
    emailCaptured: false,
    pickedMulti: [],
    intent: null
  };

  var pendingSubmits = [];

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
    var total = state.displayQuestions.length || 12;

    var bar = $('#progress-bar');
    if (bar) {
      var segs = '';
      for (var i = 0; i < total; i++) {
        var cls = 'progress-segment';
        if (i < done) cls += ' done';
        else if (i === done) cls += ' active';
        segs += '<div class="' + cls + '"></div>';
      }
      bar.innerHTML = segs;
    }

    var text = $('#progress-text');
    if (text){
      var qNum = Math.min(state.queueIdx + 1, total);
      var minsLeft = Math.max(1, Math.ceil((total - done) * 0.18));
      text.innerHTML = '<strong>Question ' + qNum + '</strong> of ' + total + ' &middot; about ' + minsLeft + ' min remaining';
    }
  }

  function buildQueue(){
    state.displayQuestions = window.RESHAPE_QUESTIONS.filter(function(q){
      if (typeof q.skipIf === 'function' && q.skipIf(state.answers)){
        if (q.skipValue && !state.answers[q.id]){
          state.answers[q.id] = q.skipValue;
          sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(state.answers));
          var sp = fetchEdge(SESSION_FN, { action: 'submit_answer', session_id: state.sessionId, question_id: q.id, answer_value: q.skipValue })
            .catch(function(){});
          pendingSubmits.push(sp);
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

  function submitAnswer(q, value){
    state.answers[q.id] = value;
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(state.answers));
    var p = fetchEdge(SESSION_FN, { action: 'submit_answer', session_id: state.sessionId, question_id: q.id, answer_value: value })
      .catch(function(){});
    pendingSubmits.push(p);
    state.queueIdx += 1;
    buildQueue();
    renderQuestion();
  }

  function renderQuestion(){
    progressUpdate();
    var q = state.displayQuestions[state.queueIdx];
    if (!q) {
      if (!state.intent) return renderIntent();
      return submitFinal();
    }

    var gateIdx = state.displayQuestions.findIndex(function(qq){ return qq.id === window.RESHAPE_GATE_AFTER; });
    if (!state.emailCaptured && state.queueIdx > gateIdx) {
      return renderGate();
    }

    var idx = state.queueIdx + 1;
    var total = state.displayQuestions.length;
    var existing = state.answers[q.id];
    var multiSel = (q.type === 'multi' && existing) ? existing.split(',') : [];
    state.pickedMulti = multiSel.slice();

    var getIcon = window.RESHAPE_GET_ICON;
    var optsHtml = q.options.map(function(opt){
      var isSel = q.type === 'multi'
        ? multiSel.indexOf(opt.value) > -1
        : existing === opt.value;
      var iconSvg = getIcon(q.id, opt.value);
      return ''
        + '<button class="q-opt' + (isSel ? ' selected' : '') + '" data-value="' + opt.value + '">'
        +   '<div class="q-opt-icon">' + iconSvg + '</div>'
        +   '<div class="q-opt-text">'
        +     '<div class="q-opt-title">' + opt.label + '</div>'
        +     (opt.sub ? '<div class="q-opt-sub">' + opt.sub + '</div>' : '')
        +   '</div>'
        +   '<div class="q-opt-marker' + (q.type === 'multi' ? ' square' : '') + '"></div>'
        + '</button>';
    }).join('');

    var hasSelection = q.type === 'multi' ? multiSel.length > 0 : !!existing;
    var html = ''
      + '<div class="assess-question">'
      +   '<div class="q-counter">Step ' + pad(idx) + ' of ' + pad(total) + ' &middot; ' + (q.category || '') + '</div>'
      +   '<h2 class="q-title">' + q.text + '</h2>'
      +   (q.why ? '<p class="q-why">' + q.why + '</p>' : '')
      +   '<div class="q-options">' + optsHtml + '</div>'
      +   '<div class="q-nav">'
      +     (state.queueIdx > 0
              ? '<button class="q-back" id="q-back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Back</button>'
              : '<span></span>')
      +     '<button class="q-next" id="q-next-btn"' + (hasSelection ? '' : ' disabled') + (q.type !== 'multi' ? ' style="display:none"' : '') + '>'
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
          setTimeout(function(){ submitAnswer(q, btn.getAttribute('data-value')); }, 250);
        }
      });
    });
    var nextBtn = $('#q-next-btn');
    nextBtn.addEventListener('click', function(){
      if (q.type === 'multi'){
        if (state.pickedMulti.length === 0) return;
        submitAnswer(q, state.pickedMulti.join(','));
      }
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
      + '<div class="assess-question" style="max-width:500px">'
      +   '<div class="gate">'
      +     '<div class="gate-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg></div>'
      +     '<h3>Where should we send your results?</h3>'
      +     "<p>You're halfway through. We'll send your full pattern report the moment you finish.</p>"
      +     '<div class="gate-fields">'
      +       '<input type="text" id="gate-name" placeholder="First name" autocomplete="given-name">'
      +       '<input type="email" id="gate-email" placeholder="you@example.com" autocomplete="email">'
      +       '<input type="tel" id="gate-phone" placeholder="07700 000000" autocomplete="tel">'
      +       '<input type="number" id="gate-age" placeholder="Age" min="20" max="99" inputmode="numeric">'
      +     '</div>'
      +     '<button class="gate-btn" id="gate-submit">Continue</button>'
      +     '<label class="gate-consent"><input type="checkbox" id="gate-consent" checked><span>Send me my pattern report and follow-up guidance. Unsubscribe anytime.</span></label>'
      +     '<div class="gate-error" id="gate-error"></div>'
      +     '<div class="gate-disclaimer">We never share your data. Encrypted in transit and at rest.</div>'
      +   '</div>'
      + '</div>';

    var root = $('#screen-root');
    root.innerHTML = html;

    var savedName  = sessionStorage.getItem('reshape_mens_name');
    var savedEmail = sessionStorage.getItem('reshape_mens_email');
    var savedPhone = sessionStorage.getItem('reshape_mens_phone');
    var savedAge   = sessionStorage.getItem('reshape_mens_age');
    if (savedName)  $('#gate-name').value  = savedName;
    if (savedEmail) $('#gate-email').value = savedEmail;
    if (savedPhone) $('#gate-phone').value = savedPhone;
    if (savedAge)   $('#gate-age').value   = savedAge;

    $('#gate-submit').addEventListener('click', function(){
      var name = ($('#gate-name').value || '').trim();
      var email = ($('#gate-email').value || '').trim().toLowerCase();
      var phoneRaw = ($('#gate-phone').value || '').trim();
      var phoneCleaned = phoneRaw.replace(/[\s\-\(\)]/g, '');
      var ageStr = ($('#gate-age').value || '').trim();
      var age = parseInt(ageStr, 10);
      var consent = $('#gate-consent').checked;
      var err = $('#gate-error');
      err.textContent = '';
      if (!name) return err.textContent = 'Please enter your first name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err.textContent = 'Please enter a valid email address.';
      if (!phoneCleaned || !/^(\+\d{10,15}|0[1-9]\d{8,10}|44\d{10,11})$/.test(phoneCleaned)) {
        return err.textContent = 'Please enter a valid phone number (e.g. 07700 000000).';
      }
      if (!ageStr || isNaN(age) || age < 20 || age > 99) {
        return err.textContent = 'Please enter a valid age.';
      }
      if (!consent) return err.textContent = 'Please tick the consent box to continue.';

      var btn = $('#gate-submit');
      btn.disabled = true; btn.textContent = 'Sending\u2026';
      fetchEdge(SESSION_FN, {
        action: 'capture_email',
        session_id: state.sessionId,
        funnel: 'mens',
        name: name, email: email, phone: phoneCleaned, age: age, consent_marketing: consent
      }).then(function(r){
        btn.disabled = false; btn.textContent = 'Continue';
        if (r.status !== 200){
          err.textContent = (r.body && r.body.error) ? r.body.error : 'Something went wrong. Please try again.';
          return;
        }
        state.emailCaptured = true;
        sessionStorage.setItem('reshape_mens_email', email);
        sessionStorage.setItem('reshape_mens_name', name);
        sessionStorage.setItem('reshape_mens_phone', phoneCleaned);
        sessionStorage.setItem('reshape_mens_age', String(age));
        renderQuestion();
      }).catch(function(){
        btn.disabled = false; btn.textContent = 'Continue';
        err.textContent = 'Network error. Please try again.';
      });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderIntent(){
    var root = $('#screen-root');
    root.innerHTML = ''
      + '<div class="assess-question" style="max-width:500px">'
      +   '<div class="gate">'
      +     '<div class="gate-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>'
      +     '<h3>One last thing before your results</h3>'
      +     '<p>If your assessment reveals a clear pattern, how ready are you to actually fix it?</p>'
      +     '<div class="form-options" id="intent-options" style="margin-top:1.25rem">'
      +       '<label class="form-option"><input type="radio" name="intent" value="ready_now"><span><strong>Ready now</strong> &middot; I want to start this month</span></label>'
      +       '<label class="form-option"><input type="radio" name="intent" value="within_3m"><span><strong>Within 3 months</strong> &middot; I want progress this quarter</span></label>'
      +       '<label class="form-option"><input type="radio" name="intent" value="exploring"><span><strong>Just exploring</strong> &middot; Gathering information</span></label>'
      +       '<label class="form-option"><input type="radio" name="intent" value="not_budgeting"><span><strong>Not budgeting for coaching</strong> &middot; Free resources only</span></label>'
      +     '</div>'
      +     '<button class="gate-btn" id="intent-submit" style="margin-top:1rem" disabled>See my results</button>'
      +     '<div class="gate-error" id="intent-error"></div>'
      +   '</div>'
      + '</div>';

    var submitBtn = $('#intent-submit');
    var optionsEl = $('#intent-options');
    optionsEl.addEventListener('change', function(){
      submitBtn.disabled = !optionsEl.querySelector('input[name="intent"]:checked');
    });
    submitBtn.addEventListener('click', function(){
      var picked = optionsEl.querySelector('input[name="intent"]:checked');
      if (!picked) return;
      state.intent = picked.value;
      sessionStorage.setItem('reshape_mens_intent', state.intent);
      submitFinal();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitFinal(){
    var root = $('#screen-root');
    root.innerHTML = ''
      + '<div class="loading-state">'
      +   '<div class="loading-spinner"></div>'
      +   '<h3>Reading your pattern\u2026</h3>'
      +   '<p>Cross-checking your answers across testosterone, GH, cortisol, and insulin.</p>'
      + '</div>';

    var pending = pendingSubmits.slice();
    pendingSubmits = [];

    Promise.all(pending).then(function(){
      return doScore(0);
    }).catch(function(){
      alert('Network error. Please try again.');
      root.innerHTML = '<div class="loading-state"><h3>Something went wrong.</h3><p>Please refresh and try again.</p></div>';
    });
  }

  function doScore(attempt){
    return fetchEdge(SCORE_FN, { session_id: state.sessionId, intent: state.intent }).then(function(r){
      if (r.status !== 200){
        var errBody = r.body || {};
        if (errBody.error === 'incomplete' && attempt < 2){
          var resubmits = Object.keys(state.answers).map(function(qid){
            return fetchEdge(SESSION_FN, { action: 'submit_answer', session_id: state.sessionId, question_id: qid, answer_value: state.answers[qid] })
              .catch(function(){});
          });
          return Promise.all(resubmits).then(function(){
            return doScore(attempt + 1);
          });
        }
        if (errBody.error === 'incomplete'){
          alert('Some answers didn\u2019t save. Please refresh and try again.');
        } else {
          alert(errBody.error || 'Something went wrong. Please try again.');
        }
        $('#screen-root').innerHTML = '<div class="loading-state"><h3>Something went wrong.</h3><p>Please refresh and try again.</p></div>';
        return;
      }
      try { sessionStorage.setItem('reshape_mens_result_' + state.sessionId, JSON.stringify(r.body)); } catch(e){}
      if (typeof fbq === 'function') {
        fbq('track', 'Lead', {
          content_name: 'Men Performance Assessment Completion',
          content_category: 'mens_assessment',
          archetype: (r.body && r.body.archetype) || 'unknown',
          value: 0.00,
          currency: 'GBP'
        }, { eventID: state.sessionId });
      }
      window.location.href = './result.html?session_id=' + encodeURIComponent(state.sessionId);
    });
  }

  function start(){
    var resume = utm('resume') || sessionStorage.getItem(SESSION_KEY);
    if (resume){
      state.sessionId = resume;
      sessionStorage.setItem(SESSION_KEY, resume);
      var saved = sessionStorage.getItem(ANSWERS_KEY);
      if (saved) { try { state.answers = JSON.parse(saved) || {}; } catch(e){} }
      var savedEmail = sessionStorage.getItem('reshape_mens_email');
      if (savedEmail) state.emailCaptured = true;
      var savedIntent = sessionStorage.getItem('reshape_mens_intent');
      if (savedIntent) state.intent = savedIntent;
      buildQueue();
      renderQuestion();
      return;
    }

    fetchEdge(SESSION_FN, {
      action: 'start',
      utm_source: utm('utm_source'),
      utm_campaign: utm('utm_campaign'),
      assessment_type: 'mens_performance'
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
