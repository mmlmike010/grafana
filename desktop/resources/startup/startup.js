// Reads the query string and shows the matching state. No network, no Node, no IPC.
// The query string is untrusted input: values are validated or written with textContent only.
(function () {
  'use strict';

  const STATES = ['booting', 'failed', 'port-in-use'];
  const REASONS = ['exit', 'timeout'];
  const DEFAULT_PORT = '23300';
  const SLOW_BOOT_MS = 10000;
  const MAX_DETAIL_LENGTH = 200;

  const params = new URLSearchParams(window.location.search);

  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  const theme = oneOf(params.get('theme'), ['light', 'dark'], 'dark');
  const state = oneOf(params.get('state'), STATES, 'booting');
  const reason = oneOf(params.get('reason'), REASONS, 'exit');

  // Set before first paint so the page never flashes the wrong theme.
  document.documentElement.setAttribute('data-theme', theme);

  function validPort(value) {
    if (!/^[0-9]{1,5}$/.test(value || '')) {
      return DEFAULT_PORT;
    }
    const n = Number(value);
    return n >= 1 && n <= 65535 ? String(n) : DEFAULT_PORT;
  }

  function exitStatus() {
    const code = params.get('code');
    if (/^-?\d{1,6}$/.test(code || '')) {
      return 'code ' + code;
    }
    const signal = params.get('signal');
    if (/^SIG[A-Z0-9]{1,12}$/.test(signal || '')) {
      return 'signal ' + signal;
    }
    return '';
  }

  function truncate(text, max) {
    const chars = Array.from(text);
    return chars.length > max ? chars.slice(0, max - 1).join('') + '\u2026' : text;
  }

  function show(el, visible) {
    if (el) {
      el.hidden = !visible;
    }
  }

  function render() {
    for (const el of document.querySelectorAll('[data-state]')) {
      show(el, el.getAttribute('data-state') === state);
    }
    const section = document.querySelector('[data-state="' + state + '"]');

    const port = validPort(params.get('port'));
    for (const el of document.querySelectorAll('[data-port]')) {
      el.textContent = port;
    }

    if (state === 'booting') {
      window.setTimeout(() => show(document.getElementById('booting-slow'), true), SLOW_BOOT_MS);
    }

    if (state === 'failed') {
      for (const el of section.querySelectorAll('[data-reason]')) {
        show(el, el.getAttribute('data-reason') === reason);
      }

      const status = exitStatus();
      document.getElementById('failed-exit-status').textContent = status;
      if (reason === 'exit' && status === '') {
        show(document.getElementById('failed-exit-detail'), false);
      }

      const detail = truncate((params.get('detail') || '').trim(), MAX_DETAIL_LENGTH);
      const outputEl = document.getElementById('failed-output');
      outputEl.textContent = detail;
      outputEl.title = detail;
      show(outputEl, detail !== '');

      const logs = (params.get('logs') || '').trim();
      document.getElementById('failed-logs-path').textContent = logs;
      show(document.getElementById('failed-logs'), logs !== '');
    }

    const title = section.querySelector('h1 [data-reason="' + reason + '"]') || section.querySelector('h1');
    document.title = title.textContent.replace(/\s+/g, ' ').trim();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
