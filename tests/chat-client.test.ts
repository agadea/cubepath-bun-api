/** @jest-environment jsdom */
import { createMessageElement, parseSSEChunks, handleResponseStream, handleKeydown, appendUserMessage, createAssistantPlaceholder } from '../public/js/chat-client'

describe('chat-client helpers', () => {
  test('createMessageElement creates structure with meta and body', () => {
    document.body.innerHTML = '<div id="c"></div>';
    const el = createMessageElement('user', 'hi', { name: 'Me', ts: '12:00' });
    expect(el.classList.contains('msg--user')).toBe(true);
    const meta = el.querySelector('.msg__meta');
    const body = el.querySelector('.msg__body');
    expect(meta).not.toBeNull();
    expect(body).not.toBeNull();
    expect(body.textContent).toBe('hi');
  });

  test('parseSSEChunks splits events and leaves remainder', () => {
    const part1 = 'data: {"text":"Hello"}\n\n';
    const res1 = parseSSEChunks('', part1);
    expect(res1.events.length).toBe(1);
    expect(res1.remainder).toBe('');

    const partial = 'data: {"text":"Par';
    const next = 'tial"}\n\ndata: {"text":"Next"}\n\n';
    const r = parseSSEChunks('', partial + next);
    expect(r.events.length).toBe(2);
    expect(r.remainder).toBe('');
  });

  test('handleResponseStream updates assistant placeholder incrementally and finalizes', async () => {
    document.body.innerHTML = '<div id="c"></div>';
    const container = document.getElementById('c');
    const assistant = createAssistantPlaceholder(container);

    // Create fake reader that yields two chunks (Uint8Array)
    const chunks = [
      new TextEncoder().encode('data: {"text":"Hello"}\n\n'),
      new TextEncoder().encode('data: {"text":" world"}\n\ndata: {"done": true}\n\n'),
    ];
    let i = 0;
    const reader = {
      read: async () => {
        if (i >= chunks.length) return { done: true, value: undefined };
        const v = chunks[i++];
        return { done: false, value: v };
      },
    };

    let done = false;
    await handleResponseStream(reader, assistant, () => { done = true });
    const body = assistant.querySelector('.msg__body');
    expect(body.textContent.includes('Hello')).toBe(true);
    expect(body.textContent.includes('world')).toBe(true);
    expect(done).toBe(true);
  });

  test('handleKeydown triggers submit on Enter without shift', () => {
    let called = false;
    const submit = () => { called = true };
    const ev = new KeyboardEvent('keydown', { key: 'Enter' });
    // jsdom doesn't allow dispatching on an element easily; call directly
    handleKeydown(ev, submit);
    expect(called).toBe(true);
  });

  test('appendUserMessage and placeholder attach to container', () => {
    document.body.innerHTML = '<div id="c" style="height:100px; overflow:auto"></div>';
    const container = document.getElementById('c');
    const userEl = appendUserMessage(container, 'hi there');
    expect(container.querySelectorAll('.msg--user').length).toBe(1);
    const placeholder = createAssistantPlaceholder(container);
    expect(container.querySelectorAll('.msg--assistant').length).toBe(1);
  });
});
