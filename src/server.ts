import { handleChat } from "./handlers/chat";

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

      if (url.pathname === "/chat") {
        return handleChat(req);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
}
