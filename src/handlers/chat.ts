import { openrouter } from "../openrouter";

type Message = { role: string; content: string };

function parseMessages(body: any): Message[] {
  if (!body) return [];
  if (Array.isArray(body.messages)) return body.messages;
  if (body.message) return [{ role: "user", content: String(body.message) }];
  return [];
}

function buildRequestPayload(messages: Message[]) {
  // Keep the runtime shape compatible with example usage; casted at callsite.
  return {
    model: "openrouter/free",
    messages,
    chatGenerationParams: { model: "openrouter/free", messages },
    stream: true,
  } as any;
}

function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
  return obj && typeof obj[Symbol.asyncIterator] === "function";
}

function isReadableStreamLike(obj: any): obj is { getReader: () => any } {
  return obj && typeof obj.getReader === "function";
}

async function streamAsyncIterable(result: AsyncIterable<any>, controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  for await (const chunk of result) {
    const content = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
    if (content) controller.enqueue(encoder.encode(String(content)));
    if (chunk?.usage) controller.enqueue(encoder.encode(`\n[usage] reasoningTokens:${chunk.usage.reasoningTokens}\n`));
  }
}

async function streamReader(result: { getReader: () => any }, controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  const reader = result.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (typeof value === "string") controller.enqueue(encoder.encode(value));
    else controller.enqueue(value);
  }
}

function serializeResult(result: any) {
  if (!result) return "";
  if (result?.choices) {
    return result.choices.map((c: any) => c.message?.content ?? c.delta?.content ?? JSON.stringify(c)).join("");
  }
  if (result?.output) {
    try {
      return JSON.stringify(result.output);
    } catch {
      return String(result.output);
    }
  }
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

export async function handleChat(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const messages = parseMessages(body);

  try {
    const payload = buildRequestPayload(messages);
    // Cast to any to avoid SDK TS overloads — we validated shape at runtime.
    const result = await (openrouter.chat.send as any)(payload);

    const streamBody = new ReadableStream({
      async start(controller) {
        try {
          if (isAsyncIterable(result)) {
            await streamAsyncIterable(result, controller);
            return;
          }

          if (isReadableStreamLike(result)) {
            await streamReader(result, controller);
            return;
          }

          const text = serializeResult(result);
          controller.enqueue(new TextEncoder().encode(text));
        } catch (err) {
          controller.error(err as any);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamBody, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    return new Response(`Upstream error: ${message}`, { status: 502 });
  }
}
