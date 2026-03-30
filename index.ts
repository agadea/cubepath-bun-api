Bun.serve({
	port: 3000,
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

console.log("Server running on http://localhost:3000");