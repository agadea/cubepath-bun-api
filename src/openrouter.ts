import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY || "";

// Lazy-load the OpenRouter SDK to avoid importing ESM modules at test-time
// (Jest can choke on ESM syntax in node_modules). Consumers can mock
// `openrouter.chat.send` in tests.
function createProxy() {
  let _client: any = null;

  async function ensureClient() {
    if (_client) return _client;
    // dynamic import avoids static ESM import at module load time
    const mod = await import("@openrouter/sdk");
    const OpenRouter = (mod && (mod.OpenRouter || mod.default)) as any;
    _client = new OpenRouter({ apiKey });
    return _client;
  }

  return {
    chat: {
      send: async (request: any, options?: any) => {
        const client = await ensureClient();
        return client.chat.send(request, options);
      },
    },
  } as const;
}

export const openrouter = createProxy();
