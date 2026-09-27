/* VeloMD bridge — WebKit script message handler üzerinden Python'a
   promise tabanlı çağrılar. Python sonuçları window.__bridgeResolve
   ile geri döner. */
(function () {
  'use strict';

  const pending = new Map();
  let seq = 0;

  window.__bridgeResolve = function (id, payload) {
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve(payload || {});
    }
  };

  function post(method, params, useAsync) {
    return new Promise(function (resolve) {
      const id = ++seq;
      pending.set(id, resolve);
      if (useAsync) params._async_id = id;
      try {
        window.webkit.messageHandlers.velomd.postMessage(
          JSON.stringify({ id: id, method: method, params: params })
        );
      } catch (err) {
        pending.delete(id);
        resolve({ error: String(err) });
        return;
      }
      setTimeout(function () {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ error: 'zaman aşımı: ' + method });
        }
      }, 120000);
    });
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.bridge = {
    call: function (method, params) {
      return post(method, params || {}, false);
    },
    // native dosya penceresi gibi sonucu sonra dönecek çağrılar
    callAsync: function (method, params) {
      return post(method, params || {}, true);
    },
  };
})();
