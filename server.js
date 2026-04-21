const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("Rivals Server running");

const world = {
    claims: {}, // chunkId -> team
    players: {}, // playerId -> team
    scores: {
        red: 0,
        blue: 0
    }
};

function getChunk(x, z) {
    return `${Math.floor(x / 10)}:${Math.floor(z / 10)}`;
}

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.team = null;

    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // JOIN TEAM (LOCKED FOREVER)
        if (data.type === "join_team") {
            if (world.players[ws.id]) return; // cannot switch

            const team = data.team; // "red" or "blue"
            world.players[ws.id] = team;
            ws.team = team;

            ws.send(JSON.stringify({
                type: "team_joined",
                team
            }));

            console.log(`${ws.id} joined ${team}`);
        }

        // CLAIM LAND
        if (data.type === "claim_land") {
            if (!ws.team) return;

            const chunk = getChunk(data.x, data.z);

            world.claims[chunk] = ws.team;

            world.scores[ws.team]++;

            broadcast({
                type: "land_claimed",
                chunk,
                team: ws.team,
                scores: world.scores
            });
        }

        // ATTACK CLAIM (simple war mechanic)
        if (data.type === "attack_chunk") {
            const chunk = getChunk(data.x, data.z);

            const owner = world.claims[chunk];

            if (owner && owner !== ws.team) {
                world.claims[chunk] = ws.team;

                world.scores[ws.team]++;
                world.scores[owner]--;

                broadcast({
                    type: "chunk_taken",
                    chunk,
                    newOwner: ws.team,
                    scores: world.scores
                });
            }
        }

        // PLAYER MOVE (optional tracking)
        if (data.type === "move") {
            ws.x = data.x;
            ws.z = data.z;
        }
    });

    ws.on("close", () => {
        // players stay in world permanently (Rivals concept)
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(data));
        }
    });
}
