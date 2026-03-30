// Mock the openrouter module before importing handlers to avoid loading ESM SDK in Jest
jest.mock('../src/openrouter', () => ({
  openrouter: { chat: { send: jest.fn() } },
}));

import { handleChat } from '../src/handlers/chat';
import { openrouter } from '../src/openrouter';

test('POST /chat streams SSE and first chunk arrives', async () => {
  // Mock async generator that yields two chunks.
  async function* gen() {
    yield { choices: [{ delta: { content: 'Hello' } }], usage: { reasoningTokens: 1 } };
    await new Promise((r) => setTimeout(r, 5));
    yield { choices: [{ delta: { content: ' world' } }], usage: { reasoningTokens: 2 } };
  }

  // mockImplementation should return a value compatible with the SDK runtime.
  // The SDK usually returns an EventStream (ReadableStream-like). For tests we can
  // return an object that is AsyncIterable and also provides a getReader() method
  // that the handler can use when treating it as a readable stream.
  const fakeStream = (async function* () {
    yield* gen();
  })();
  // Give it a getReader() compatible method for the handler's fallback branch
  (fakeStream as any).getReader = () => {
    const iterator = (fakeStream as any)[Symbol.asyncIterator]();
    return {
      read: async () => {
        const r = await iterator.next();
        return { done: r.done, value: typeof r.value === 'string' ? r.value : new TextEncoder().encode(JSON.stringify(r.value)) };
      },
      cancel: async () => { /* no-op */ },
    };
  };
  const spy = jest.spyOn(openrouter.chat, 'send').mockImplementation(async () => fakeStream as any);

  const req = new Request('http://localhost/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
  });

  const res = await handleChat(req);
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  // Should contain an SSE data: line with the partial 'Hello'
  expect(chunk).toMatch(/data:\s*\{.*Hello.*\}/);

  spy.mockRestore();
});
