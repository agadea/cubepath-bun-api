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
  metaEl.textContent = `${meta.name ?? (role === 'user' ? 'You' : 'Assistant')}${meta.ts ? ' • ' + meta.ts : ''}`;

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
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunkStr;
      if (typeof value === 'string') chunkStr = value;
      else if (value instanceof Uint8Array) chunkStr = decoder.decode(value);
      else chunkStr = String(value);
      const { events, remainder } = parseSSEChunks(buf, chunkStr);
      buf = remainder;
      for (const ev of events) {
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
