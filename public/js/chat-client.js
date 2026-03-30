// Minimal client-side chat helpers for incremental SSE rendering
// This file is written in plain JS to avoid build steps and is testable with jsdom.

/** Create a message bubble element.
 * role: 'user' | 'assistant'
 * text: initial text
 * meta: optional object { name, ts }
 */
export function createMessageElement(role, text, meta = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg msg--${role}`;

  const metaEl = document.createElement('div');
  metaEl.className = 'msg__meta';
  const avatar = document.createElement('span');
  avatar.className = 'msg__avatar';
  avatar.textContent = meta.avatar ?? (role === 'user' ? '👤' : '🤖');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'msg__name';
  nameSpan.textContent = meta.name ?? (role === 'user' ? 'You' : 'Assistant');

  const tsSpan = document.createElement('span');
  tsSpan.className = 'msg__ts';
  tsSpan.textContent = meta.ts ? ' • ' + meta.ts : '';
  metaEl.appendChild(avatar);
  metaEl.appendChild(nameSpan);
  metaEl.appendChild(tsSpan);

  const body = document.createElement('div');
  body.className = 'msg__body';
  body.textContent = text || '';

  wrapper.appendChild(metaEl);
  wrapper.appendChild(body);
  return wrapper;
}

/** Append a user message to container and return the element */
export function appendUserMessage(container, text) {
  const el = createMessageElement('user', text, { ts: new Date().toLocaleTimeString() });
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

/** Create an assistant placeholder element to be updated incrementally */
export function createAssistantPlaceholder(container) {
  const el = createMessageElement('assistant', '', { ts: new Date().toLocaleTimeString() });
  el.classList.add('placeholder');
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

/** Parse SSE-style chunks from an accumulator and a new chunk string.
 * Returns { events: Array<any>, remainder: string }
 */
export function parseSSEChunks(acc, chunk) {
  const combined = acc + chunk;
  const parts = combined.split('\n\n');
  const remainder = parts.pop() || '';
  const events = [];
  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        try {
          events.push(JSON.parse(payload));
        } catch (err) {
          events.push(payload);
        }
      }
    }
  }
  return { events, remainder };
}

/** Handle a response stream reader (object with async read() method) and update assistant element.
 * reader.read() should return { done, value } where value may be Uint8Array or string.
 * onDone() is called when stream finishes or hits done event.
 */
export async function handleResponseStream(reader, assistantEl, onDone = () => {}) {
  // TextDecoder may be missing in some test environments; fall back to util.TextDecoder
  const _TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : (typeof require !== 'undefined' ? require('util').TextDecoder : null);
  const decoder = _TextDecoder ? new _TextDecoder() : { decode: (v) => (typeof v === 'string' ? v : new TextDecoder().decode(v)) };
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunkStr;
      if (typeof value === 'string') chunkStr = value;
      else if (value instanceof Uint8Array) chunkStr = decoder.decode(value);
      else chunkStr = String(value);
      try { console.error('chat-client:chunkStr', chunkStr); } catch (e) {}
      const { events, remainder } = parseSSEChunks(buf, chunkStr);
      try { console.error('chat-client:parsedEvents', events); } catch (e) {}
      buf = remainder;
      for (const ev of events) {
        // debug: log parsed event (helps while running tests)
        // eslint-disable-next-line no-console
        try { console.error('chat-client:ev', ev); } catch (e) {}
        if (ev === null || ev === undefined) continue;
        if (typeof ev === 'object' && ev.error) {
          assistantEl.querySelector('.msg__body').textContent += '\n[Error] ' + String(ev.error);
          onDone();
          return;
        }
        if (typeof ev === 'object' && ev.done) {
          onDone();
          return;
        }
        // append text
        const text = typeof ev === 'string' ? ev : String(ev.text ?? ev);
        assistantEl.querySelector('.msg__body').textContent += text;
        assistantEl.classList.remove('placeholder');
      }
    }
  } catch (err) {
    assistantEl.querySelector('.msg__body').textContent += '\n[Error] ' + String(err);
  } finally {
    onDone();
  }
}

// Small helpers for UI state (keep local state)
let _currentAbortController = null;

export function setSendingState(formEl, isSending) {
  const btn = formEl.querySelector('button[type="submit"]');
  if (!btn) return;
  if (isSending) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  } else {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

export function abortCurrentRequest() {
  if (_currentAbortController) {
    try { _currentAbortController.abort(); } catch (e) {}
    _currentAbortController = null;
  }
}

export function createAbortController() {
  // In browsers, AbortController exists; in tests we can mock simple objects
  if (typeof AbortController !== 'undefined') {
    _currentAbortController = new AbortController();
    return _currentAbortController;
  }
  // fallback
  _currentAbortController = { abort() { } };
  return _currentAbortController;
}

/** Handle keydown in textarea: Enter (no Shift) => submitFn, Shift+Enter => newline */
export function handleKeydown(event, submitFn) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitFn();
  }
}

/** Attach client behavior to DOM: binds form, keydown, send flow, and cancel */
export function attachChatClient() {
  const form = document.getElementById('chat-form');
  const textarea = document.getElementById('prompt');
  const messages = document.getElementById('messages');
  const cancelBtn = document.getElementById('cancel-btn');
  if (!form || !textarea || !messages) return;

  function formatTs(d = new Date()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let isSending = false;
  async function doSend() {
    const sendBtn = form.querySelector('button[type="submit"]');
    if (isSending || (sendBtn && sendBtn.disabled)) return;

    const prompt = textarea.value || '';
    if (!prompt.trim()) return;

    // Prevent duplicate sends immediately and update UI
    isSending = true;
    setSendingState(form, true);
    cancelBtn.style.display = 'inline-block';

    // Capture text and clear input immediately to avoid accidental duplicate sends
    const textToSend = prompt;
    textarea.value = '';
    textarea.focus();

    // Create UI entries
    appendUserMessage(messages, textToSend);
    const assistantEl = createAssistantPlaceholder(messages);

    const controller = createAbortController();

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: textToSend }] }),
        signal: controller.signal,
      });

      if (!res.ok) {
        assistantEl.querySelector('.msg__body').textContent = '[Error] ' + res.statusText;
        return;
      }

      const reader = res.body.getReader();
      await handleResponseStream(reader, assistantEl, () => {
        setSendingState(form, false);
        cancelBtn.style.display = 'none';
      });
    } catch (err) {
      assistantEl.querySelector('.msg__body').textContent = '[Error] ' + String(err);
    } finally {
      isSending = false;
      setSendingState(form, false);
      cancelBtn.style.display = 'none';
      abortCurrentRequest();
      textarea.focus();
    }
  }

  // submit handler
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    doSend();
  });

  // keydown for Enter/Shift+Enter
  textarea.addEventListener('keydown', (ev) => handleKeydown(ev, () => form.requestSubmit()));

  // cancel button
  cancelBtn.addEventListener('click', () => {
    abortCurrentRequest();
    setSendingState(form, false);
    cancelBtn.style.display = 'none';
  });
}
