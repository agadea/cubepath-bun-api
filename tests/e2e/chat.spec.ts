import { test, expect } from '@playwright/test';

test('chat streaming visual flow', async ({ page }) => {
  // Inject a fetch override before the page loads so client code receives a streaming SSE-like response
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    (window as any).__originalFetch = originalFetch;
    window.fetch = (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (typeof url === 'string' && url.endsWith('/chat')) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: ' + JSON.stringify({ text: 'Hola', done: false }) + '\n\n'));
            setTimeout(() => {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ text: ' mundo', done: true }) + '\n\n'));
              controller.close();
            }, 120);
          },
        });
        return Promise.resolve(new Response(stream as any, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return originalFetch(input, init);
    };
  });

  await page.goto('/');
  await page.waitForSelector('#prompt');

  // Send a message (Enter submits)
  await page.fill('#prompt', 'Prueba Playwright');
  await page.press('#prompt', 'Enter');

  // Wait for streamed pieces to arrive and be rendered
  const messages = page.locator('#messages');
  await expect(messages).toContainText('Hola');
  await expect(messages).toContainText('mundo');

  // Save a visual artifact of the chat area
  await messages.screenshot({ path: 'tests/e2e/screenshots/chat-flow.png' });
});
