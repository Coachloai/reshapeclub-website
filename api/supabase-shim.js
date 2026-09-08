/* ══════════════════════════════════════
   Supabase Client Shim for automations.js
   Routes DB operations through api.reshape.fit/website/*
   while automations.js edge function calls (fetch-based) work unchanged.
══════════════════════════════════════ */

(function() {
  var API = window.__apiBase || 'https://api.reshape.fit/website';

  function api(path, opts) {
    var url = API + path;
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function(r) { return r.json(); });
  }

  window.__supabaseClient = {
    from: function(table) {
      var _filters = [];
      var _updates = null;

      function findFilter(col) {
        for (var i = 0; i < _filters.length; i++) {
          if (_filters[i][0] === col) return _filters[i][1];
        }
        return undefined;
      }

      var chain = {
        select: function() { return chain; },

        insert: function(rows) {
          var arr = Array.isArray(rows) ? rows : [rows];

          if (table === 'message_queue') {
            return Promise.all(arr.map(function(r) {
              return api('/messages/queue', { method: 'POST', body: JSON.stringify(r) })
                .then(function(res) { return res.message || r; })
                .catch(function() { return r; });
            })).then(function(results) {
              return { data: results, error: null };
            });
          }

          if (table === 'leads') {
            var r = arr[0];
            return api('/leads', { method: 'POST', body: JSON.stringify(r) })
              .then(function(res) { return { data: res.lead || null, error: null }; })
              .catch(function() { return { data: null, error: null }; });
          }

          return Promise.resolve({ data: null, error: null });
        },

        update: function(data) { _updates = data; return chain; },
        eq: function(col, val) { _filters.push([col, val]); return chain; },
        neq: function() { return chain; },
        is: function() { return chain; },
        ilike: function() { return chain; },
        gte: function() { return chain; },
        in: function() { return chain; },
        order: function() { return chain; },
        limit: function() { return chain; },
        single: function() { return chain; },
        maybeSingle: function() { return chain; },

        then: function(resolve, reject) {
          // Handle message_queue cancellation
          if (_updates && _updates.status === 'cancelled' && table === 'message_queue') {
            var email = findFilter('lead_email');
            var seq = findFilter('sequence');
            if (email) {
              api('/messages/cancel', {
                method: 'POST',
                body: JSON.stringify({ email: email, sequence: seq || null })
              }).then(function() {
                if (resolve) resolve({ data: null, error: null });
              }).catch(function() {
                if (resolve) resolve({ data: null, error: null });
              });
              return;
            }
          }

          // Handle message_queue status update (sent/failed) — just resolve, not critical
          if (_updates && table === 'message_queue') {
            if (resolve) resolve({ data: null, error: null });
            return;
          }

          // Default: resolve with null data (triggers fallbacks in automations.js)
          if (resolve) resolve({ data: null, error: null });
        },

        catch: function(fn) {
          return chain;
        }
      };

      return chain;
    },

    // RPC stub (not used by automations.js, but here for completeness)
    rpc: function() { return Promise.resolve({ data: null, error: null }); }
  };
})();
