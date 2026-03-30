import { handleChat } from "./handlers/chat";
import fs from "fs/promises";
import ejs from "ejs";
// ejs does not ship TypeScript types here; tests and build use ts-jest which tolerates this.

let _cachedPicoCss: string | null = null;
async function getPicoCss(): Promise<string> {
  if (_cachedPicoCss) return _cachedPicoCss;
  const cssPath = new URL("../node_modules/@picocss/pico/css/pico.min.css", import.meta.url).pathname;
  _cachedPicoCss = await fs.readFile(cssPath, "utf8");
  return _cachedPicoCss;
}

export async function renderChatPage(): Promise<Response> {
  const viewPath = new URL("../views/chat.ejs", import.meta.url).pathname;
  const html = await new Promise<string>((resolve, reject) => {
    ejs.renderFile(viewPath, {}, {}, (err: any, str: any) => {
      if (err) reject(err);
      else resolve(String(str));
    });
  });
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function startServer() {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  Bun.serve({
    port: PORT,
    async fetch(req: Request) {
      const url = new URL(req.url);

      if (url.pathname === "/health" && req.method === "GET") {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/") {
        return await renderChatPage();
      }

      if (url.pathname === "/css/pico.min.css" && req.method === "GET") {
        try {
          const css = await getPicoCss();
          return new Response(css, { status: 200, headers: { "Content-Type": "text/css; charset=utf-8" } });
        } catch (err: any) {
          return new Response("Not found", { status: 404 });
        }
      }

      if (url.pathname === "/chat") {
        return handleChat(req);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
}
