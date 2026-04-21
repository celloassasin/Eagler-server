const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("PvP Arena Server running");

const queues = {
    "1v1": [],
    "2v2": [],
    "3v3": [],
    "4v4": [],
    "ffa": []
};

const arenaList = [
    "desert_ruins",
    "sky_temple",
    "lava_castle"
];

function startMatch(mode, players) {
    const arena = arenaList[Math.floor(Math.random() * arenaList.length)];

    players.forEach(p => {
        p.send(JSON.stringify({
            type: "match_start",
            mode,
            arena
        }));
    });

    console.log(`Started ${mode} on ${arena}`);
}

function tryMatch(mode) {
    const q = queues[mode];

    const needed = {
        "1v1": 2,
        "2v2": 4,
        "3v3": 6,
        "4v4": 8,
        "ffa": 6
    }[mode];

    if (q.length >= needed) {
        const players = q.splice(0, needed);
        startMatch(mode, players);
    }
}

wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // JOIN QUEUE
        if (data.type === "queue") {
            if (!queues[data.mode]) return;

            queues[data.mode].push(ws);
            tryMatch(data.mode);
        }

        // SIMPLE ACTIONS (placeholder combat sync)
        if (data.type === "hit") {
            ws.send(JSON.stringify({ type: "hit_confirmed" }));
        }

        if (data.type === "death") {
            ws.send(JSON.stringify({ type: "respawn" }));
        }
    });
});
