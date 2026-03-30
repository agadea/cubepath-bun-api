import { handleChat } from '../src/handlers/chat';
import { openrouter } from '../src/openrouter';

test('POST /chat streams SSE and first chunk arrives', async () => {
  // Mock async generator that yields two chunks.
  async function* gen() {
    yield { choices: [{ delta: { content: 'Hello' } }], usage: { reasoningTokens: 1 } };
    await new Promise((r) => setTimeout(r, 5));
    yield { choices: [{ delta: { content: ' world' } }], usage: { reasoningTokens: 2 } };
  }

  const spy = jest.spyOn(openrouter.chat, 'send').mockImplementation(async () => gen());

  const req = new Request('http://localhost/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
  });

  const res = await handleChat(req);
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);

  const reader = res.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  // Should contain an SSE data: line with the partial 'Hello'
  expect(chunk).toMatch(/data:\s*\{.*Hello.*\}/);

  spy.mockRestore();
});
