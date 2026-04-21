const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("Server running");

const players = new Set();

wss.on("connection", (ws) => {
    players.add(ws);

    ws.send(JSON.stringify({
        type: "connected",
        message: "Welcome"
    }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // simple test system
        if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
        }
    });

    ws.on("close", () => {
        players.delete(ws);
    });
});
