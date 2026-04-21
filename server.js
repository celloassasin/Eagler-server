const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("Server running");

wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        if (data.type === "queue") {
            ws.send(JSON.stringify({
                type: "match_start",
                mode: data.mode
            }));
        }
    });
});
