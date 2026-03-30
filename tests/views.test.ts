import { renderChatPage } from '../src/server';

test('GET / renders chat page and references pico CSS', async () => {
  const res = await renderChatPage();
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/href="\/css\/pico.min.css"/);
  expect(html).toMatch(/id="chat-form"/);
});
