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

function sseEncode(text: string) {
  const first = `data: ${String(text).replace(/\r/g, "").replace(/\n/g, "\ndata: ")}`;
  return new TextEncoder().encode(first + "\n\n");
}

async function streamAsyncIterable(result: AsyncIterable<any>, controller: ReadableStreamDefaultController) {
  for await (const chunk of result) {
    const content = chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
    if (content) {
      const payload = { text: String(content), usage: chunk?.usage ?? null };
      controller.enqueue(sseEncode(JSON.stringify(payload)));
    }
  }
}

async function streamReader(result: { getReader: () => any }, controller: ReadableStreamDefaultController) {
  const reader = result.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    let chunkStr: string;
    if (typeof value === "string") chunkStr = value;
    else if (value instanceof Uint8Array) chunkStr = new TextDecoder().decode(value);
    else chunkStr = String(value);
    const payload = { text: chunkStr };
    controller.enqueue(sseEncode(JSON.stringify(payload)));
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
          } else if (isReadableStreamLike(result)) {
            await streamReader(result, controller);
          } else {
            const text = serializeResult(result);
            controller.enqueue(sseEncode(text));
          }
          // send done event
          controller.enqueue(sseEncode(JSON.stringify({ done: true })));
        } catch (err) {
          controller.enqueue(sseEncode(JSON.stringify({ error: String(err) })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    return new Response(`Upstream error: ${message}`, { status: 502 });
  }
}
