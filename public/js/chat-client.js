// Spanish-localized chat client with simple Markdown rendering,
// toggle send/cancel behavior, auto-scroll, and innerHTML rendering.
//
// Exports: createMessageElement, appendUserMessage, createAssistantPlaceholder,
// parseSSEChunks, handleResponseStream, handleKeydown, attachChatClient

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(raw) {
  if (raw == null) return '';
  let text = String(raw);

  // Extract fenced code blocks first to avoid inner replacements
  const blocks = [];
  text = text.replace(/```([\s\S]*?)```/g, (m, code) => {
    const id = `___CODE_BLOCK_${blocks.length}___`;
    blocks.push(code);
    return id;
  });

  // Escape the main body
  text = escapeHtml(text);

  // Inline code
  text = text.replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`);

  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });

  // Bold **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, (m, t) => `<strong>${t}</strong>`);

  // Italic *text*
  text = text.replace(/\*([^*]+)\*/g, (m, t) => `<em>${t}</em>`);

  // Restore code blocks (escaped)
  text = text.replace(/___CODE_BLOCK_(\d+)___/g, (m, idx) => {
    const code = blocks[Number(idx)] || '';
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  return text;
}

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
  nameSpan.textContent = meta.name ?? (role === 'user' ? 'Tú' : 'Asistente');

  const tsSpan = document.createElement('span');
  tsSpan.className = 'msg__ts';
  tsSpan.textContent = meta.ts ? ' • ' + meta.ts : '';
  metaEl.appendChild(avatar);
  metaEl.appendChild(nameSpan);
  metaEl.appendChild(tsSpan);

  const body = document.createElement('div');
  body.className = 'msg__body';
  body.innerHTML = renderMarkdown(text ?? '');

  wrapper.appendChild(metaEl);
  wrapper.appendChild(body);
  return wrapper;
}

export function appendUserMessage(container, text) {
  const el = createMessageElement('user', text, { ts: new Date().toLocaleTimeString() });
  container.appendChild(el);
  try {
    container.scrollTop = container.scrollHeight;
  } catch (e) {}
  return el;
}

export function createAssistantPlaceholder(container) {
  const el = createMessageElement('assistant', '', { ts: new Date().toLocaleTimeString() });
  el.classList.add('placeholder');
  // ensure body is empty HTML so incremental rendering uses innerHTML
  el.querySelector('.msg__body').innerHTML = '';
  container.appendChild(el);
  try {
    container.scrollTop = container.scrollHeight;
  } catch (e) {}
  return el;
}

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

let _currentAbortController = null;

export function createAbortController() {
  if (typeof AbortController !== 'undefined') {
    _currentAbortController = new AbortController();
    return _currentAbortController;
  }
  _currentAbortController = { abort() {} };
  return _currentAbortController;
}

export function abortCurrentRequest() {
  if (_currentAbortController) {
    try { _currentAbortController.abort(); } catch (e) {}
    _currentAbortController = null;
  }
}

export async function handleResponseStream(reader, assistantEl, onDone = () => {}) {
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
      const { events, remainder } = parseSSEChunks(buf, chunkStr);
      buf = remainder;
      for (const ev of events) {
        if (ev === null || ev === undefined) continue;
        if (typeof ev === 'object' && ev.error) {
          const body = assistantEl.querySelector('.msg__body');
          body.innerHTML += `<div class="error">${escapeHtml(String(ev.error))}</div>`;
          onDone();
          return;
        }
        if (typeof ev === 'object' && ev.done) {
          onDone();
          return;
        }
        const text = typeof ev === 'string' ? ev : String(ev.text ?? ev);
        const body = assistantEl.querySelector('.msg__body');
        // Append rendered markdown HTML
        body.innerHTML += renderMarkdown(text);
        // Auto-scroll container if present
        const container = assistantEl.parentElement;
        if (container) {
          try { container.scrollTop = container.scrollHeight; } catch (e) {}
        }
        assistantEl.classList.remove('placeholder');
      }
    }
  } catch (err) {
    const body = assistantEl.querySelector('.msg__body');
    body.innerHTML += `<div class="error">${escapeHtml(String(err))}</div>`;
  } finally {
    onDone();
  }
}

export function setSendingState(formEl, isSending) {
  const sendBtn = document.getElementById('send-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  if (sendBtn) {
    if (isSending) {
      sendBtn.textContent = 'Cancelar';
      try { sendBtn.type = 'button'; } catch (e) {}
      sendBtn.setAttribute('aria-busy', 'true');
    } else {
      sendBtn.textContent = 'Enviar';
      try { sendBtn.type = 'submit'; } catch (e) {}
      sendBtn.removeAttribute('aria-busy');
    }
  }
  if (cancelBtn) {
    cancelBtn.style.display = isSending ? 'inline-block' : 'none';
  }
}

export function handleKeydown(event, submitFn) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitFn();
  }
}

export function attachChatClient() {
  const form = document.getElementById('chat-form');
  const textarea = document.getElementById('prompt');
  const messages = document.getElementById('messages');
  const cancelBtn = document.getElementById('cancel-btn');
  const sendBtn = document.getElementById('send-btn');
  if (!form || !textarea || !messages) return;

  function formatTs(d = new Date()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let isSending = false;
  async function doSend() {
    if (isSending) return;
    const prompt = textarea.value || '';
    if (!prompt.trim()) return;

    isSending = true;
    setSendingState(form, true);

    const textToSend = prompt;
    textarea.value = '';
    textarea.focus();

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
        assistantEl.querySelector('.msg__body').innerHTML = `<div class="error">${escapeHtml(res.statusText)}</div>`;
        return;
      }

      const reader = res.body.getReader();
      await handleResponseStream(reader, assistantEl, () => {
        isSending = false;
        setSendingState(form, false);
      });
    } catch (err) {
      assistantEl.querySelector('.msg__body').innerHTML = `<div class="error">${escapeHtml(String(err))}</div>`;
    } finally {
      isSending = false;
      setSendingState(form, false);
      abortCurrentRequest();
      textarea.focus();
    }
  }

  // submit handler
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!isSending) doSend();
  });

  // keydown for Enter/Shift+Enter (only submit when not sending)
  textarea.addEventListener('keydown', (ev) => handleKeydown(ev, () => { if (!isSending) form.requestSubmit(); }));

  // send button: when sending, clicking it cancels
  if (sendBtn) {
    sendBtn.addEventListener('click', (ev) => {
      if (isSending) {
        ev.preventDefault();
        abortCurrentRequest();
        isSending = false;
        setSendingState(form, false);
      }
    });
  }

  // cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      abortCurrentRequest();
      isSending = false;
      setSendingState(form, false);
    });
  }
}
