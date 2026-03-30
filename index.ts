const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

Bun.serve({
	port: PORT,
	fetch(req) {
		const url = new URL(req.url);
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({ status: "ok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not found", { status: 404 });
	},
});

console.log(`Server running on http://localhost:${PORT}`);