// Waitlist mode switcher — reads site_settings.waitlist_enabled from Supabase
// and swaps copy/links across the page.
//
// Usage: add data-open="Open text" data-waitlist="Waitlist text" to any element.
// Elements with data-open/data-waitlist will have their textContent swapped.
// Elements with data-open-href/data-waitlist-href will have their href swapped.
// Elements with data-waitlist-hide will be hidden when waitlist is ON.
// Elements with data-waitlist-show will be shown when waitlist is ON.

(function() {
  var SB_URL = 'https://lvizldmdficsfpgegehp.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

  function applyMode(isWaitlist) {
    window.__waitlistEnabled = isWaitlist;
    var mode = isWaitlist ? 'waitlist' : 'open';
    var other = isWaitlist ? 'open' : 'waitlist';

    // Swap text content
    document.querySelectorAll('[data-' + mode + ']').forEach(function(el) {
      if (el.getAttribute('data-' + mode)) {
        el.textContent = el.getAttribute('data-' + mode);
      }
    });

    // Swap href
    document.querySelectorAll('[data-' + mode + '-href]').forEach(function(el) {
      if (el.getAttribute('data-' + mode + '-href')) {
        el.href = el.getAttribute('data-' + mode + '-href');
      }
    });

    // Show/hide
    document.querySelectorAll('[data-waitlist-hide]').forEach(function(el) {
      el.style.display = isWaitlist ? 'none' : '';
    });
    document.querySelectorAll('[data-waitlist-show]').forEach(function(el) {
      el.style.display = isWaitlist ? '' : 'none';
    });

    // Instagram redirect countdown for waitlist success views
    if (isWaitlist) {
      var countdownEls = document.querySelectorAll('.ig-countdown');
      if (countdownEls.length) {
        // Start countdown when formSuccess becomes visible (form submitted)
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(m) {
            if (m.target.classList && m.target.classList.contains('active')) {
              observer.disconnect();
              var seconds = 5;
              var interval = setInterval(function() {
                seconds--;
                countdownEls.forEach(function(el) { el.textContent = seconds; });
                if (seconds <= 0) {
                  clearInterval(interval);
                  window.location.href = 'https://www.instagram.com/reshape.club';
                }
              }, 1000);
            }
          });
        });
        var formSuccess = document.getElementById('formSuccess');
        if (formSuccess) {
          observer.observe(formSuccess, { attributes: true, attributeFilter: ['class'] });
        }
      }
    }
  }

  // Try using existing Supabase client, or create minimal one
  function check() {
    var client = window.__supabaseClient;
    if (!client && typeof supabase !== 'undefined') {
      client = supabase.createClient(SB_URL, SB_KEY);
    }
    if (!client) return;

    client.from('site_settings').select('waitlist_enabled').eq('id', 'global').maybeSingle()
      .then(function(res) {
        if (res.data) applyMode(res.data.waitlist_enabled);
      })
      .catch(function() { /* default to open — no swap needed */ });
  }

  // Run after DOM is ready and Supabase client may be initialised
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(check, 50); });
  } else {
    setTimeout(check, 50);
  }
})();
