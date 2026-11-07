// Troca o localStorage "scout_*" por chamadas ao servidor, sem alterar o resto do HTML.
(function () {
  var ID_KEYS = { players: 1, market: 1, reports: 1, history: 1 };
  var cache = null, chain = Promise.resolve();
  function banner(msg) {
    function show() { var d = document.createElement('div'); d.textContent = msg;
      d.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#40351d;color:#f2cb78;border:1px solid #66552c;padding:10px 16px;border-radius:10px;z-index:99;font:12px system-ui';
      document.body.appendChild(d); }
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  try { var x = new XMLHttpRequest(); x.open('GET', '/api/state', false); x.send(); if (x.status === 200) cache = JSON.parse(x.responseText); } catch (e) {}
  if (!cache) { banner('Servidor/banco indisponível: usando apenas dados locais deste navegador.'); return; }

  // A base usa "Meio-campo" e "Atacante"; sem estas opções o formulário apagaria a posição ao salvar.
  document.addEventListener('DOMContentLoaded', function () {
    ['filterPosition', 'pPosition'].forEach(function (id) {
      var s = document.getElementById(id); if (!s) return;
      ['Meio-campo', 'Atacante'].forEach(function (v) {
        if (!Array.prototype.some.call(s.options, function (o) { return o.text === v; })) s.add(new Option(v));
      });
    });
  });

  function send(method, url, body) {
    chain = chain.then(function () {
      return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
    }).catch(function (e) { banner('Falha ao salvar no banco (' + e.message + '). Recarregue a página.'); });
  }
  function mine(self, k) { return self === localStorage && k.indexOf('scout_') === 0 && (ID_KEYS[k.slice(6)] || k === 'scout_roles' || k === 'scout_tactical'); }
  var rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem;
  Storage.prototype.getItem = function (k) {
    if (mine(this, k)) { var n = k.slice(6); return cache[n] === undefined ? null : JSON.stringify(cache[n]); }
    return rawGet.call(this, k);
  };
  Storage.prototype.setItem = function (k, v) {
    if (!mine(this, k)) return rawSet.call(this, k, v);
    var n = k.slice(6), next = JSON.parse(v);
    if (ID_KEYS[n]) { // envia só o que mudou
      var prev = {}, seen = {};
      (cache[n] || []).forEach(function (i) { prev[i.id] = JSON.stringify(i); });
      next.forEach(function (i) { seen[i.id] = 1; if (prev[i.id] !== JSON.stringify(i)) send('PUT', '/api/' + n + '/' + encodeURIComponent(i.id), i); });
      Object.keys(prev).forEach(function (id) { if (!seen[id]) send('DELETE', '/api/' + n + '/' + encodeURIComponent(id)); });
    } else send('PUT', '/api/' + n, next);
    cache[n] = next;
  };
})();
