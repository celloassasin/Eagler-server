const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("Eagler Multi-Mode Server Running");

// Players
const players = new Map();

// MODE GROUPS
const modes = {
    bedwars: new Set(),
    pvp: new Set(),
    survival: new Set(),
    rivals: new Set()
};

// Utility broadcast
function broadcast(set, data) {
    set.forEach(ws => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(data));
        }
    });
}

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.mode = null;
    ws.team = null;

    players.set(ws.id, ws);

    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // 🎮 JOIN MODE
        if (data.type === "join_mode") {
            ws.mode = data.mode;

            for (let m in modes) {
                modes[m].delete(ws);
            }

            modes[data.mode].add(ws);

            ws.send(JSON.stringify({
                type: "mode_joined",
                mode: data.mode
            }));
        }

        // 🚦 ROUTING TO MODES
        if (ws.mode === "rivals") handleRivals(ws, data);
        if (ws.mode === "pvp") handlePvP(ws, data);
        if (ws.mode === "bedwars") handleBedwars(ws, data);
        if (ws.mode === "survival") handleSurvival(ws, data);
    });

    ws.on("close", () => {
        players.delete(ws.id);
        for (let m in modes) modes[m].delete(ws);
    });
});
