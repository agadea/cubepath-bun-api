import { openrouter } from "../openrouter";

export async function handleChat(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const messages = body.messages ?? (body.message ? [{ role: "user", content: String(body.message) }] : []);

  try {
    // Follow the example usage provided — pass model, messages and stream flag
    const stream = await openrouter.chat.send({
      model: "openrouter/free",
      messages,
      // include chatGenerationParams to satisfy SDK validation
      chatGenerationParams: {},
      stream: true,
    });

    const encoder = new TextEncoder();

    const streamBody = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));

            if (chunk.usage) {
              const usageLine = `\n[usage] reasoningTokens:${chunk.usage.reasoningTokens}\n`;
              controller.enqueue(encoder.encode(usageLine));
            }
          }
        } catch (err) {
          controller.error(err as any);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    return new Response(`Upstream error: ${message}`, { status: 502 });
  }
}
