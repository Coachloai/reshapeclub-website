// Waitlist mode switcher — reads site_settings from API
// and swaps copy/links across the page.
//
// Usage: add data-open="Open text" data-waitlist="Waitlist text" to any element.
// Elements with data-open/data-waitlist will have their textContent swapped.
// Elements with data-open-href/data-waitlist-href will have their href swapped.
// Elements with data-waitlist-hide will be hidden when waitlist is ON.
// Elements with data-waitlist-show will be shown when waitlist is ON.

(function() {
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

  function check() {
    var apiBase = window.__apiBase || 'https://api.reshape.fit/website';
    fetch(apiBase + '/settings')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.settings) applyMode(res.settings.waitlist_enabled);
      })
      .catch(function() { /* default to open — no swap needed */ });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(check, 50); });
  } else {
    setTimeout(check, 50);
  }
})();
