const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("Rivals Full Server Running");

const world = {
    claims: {},   // chunkId -> team
    chunks: {},   // chunkId -> blocks
};

const economy = {
    red: 0,
    blue: 0
};

const players = {}; // id -> team

function getChunk(x, z) {
    return `${Math.floor(x / 10)}:${Math.floor(z / 10)}`;
}

function broadcast(data) {
    wss.clients.forEach(c => {
        if (c.readyState === 1) {
            c.send(JSON.stringify(data));
        }
    });
}

//
// 💰 ECONOMY LOOP (passive income from land)
//
setInterval(() => {
    for (let chunk in world.claims) {
        const team = world.claims[chunk];
        if (team) economy[team] += 1;
    }

    broadcast({
        type: "economy_update",
        economy
    });

}, 5000);

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.team = null;
    ws.raidMode = false;

    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        //
        // 🏳️ JOIN TEAM (LOCKED PERMANENTLY)
        //
        if (data.type === "join_team") {
            if (players[ws.id]) return;

            players[ws.id] = data.team;
            ws.team = data.team;

            ws.send(JSON.stringify({
                type: "team_joined",
                team: ws.team
            }));
        }

        //
        // 🏗️ BASE BUILDING (place blocks in owned land)
        //
        if (data.type === "place_block") {
            if (!ws.team) return;

            const chunk = getChunk(data.x, data.z);

            if (world.claims[chunk] && world.claims[chunk] !== ws.team) return;

            if (!world.chunks[chunk]) world.chunks[chunk] = [];

            world.chunks[chunk].push({
                x: data.x,
                y: data.y,
                z: data.z,
                type: data.block
            });

            broadcast({
                type: "block_place",
                x: data.x,
                y: data.y,
                z: data.z,
                block: data.block
            });
        }

        //
        // 🗺️ CLAIM LAND
        //
        if (data.type === "claim_land") {
            if (!ws.team) return;

            const chunk = getChunk(data.x, data.z);

            world.claims[chunk] = ws.team;

            broadcast({
                type: "land_claimed",
                chunk,
                team: ws.team
            });
        }

        //
        // ⚔️ START RAID MODE
        //
        if (data.type === "start_raid") {
            ws.raidMode = true;

            broadcast({
                type: "raid_started",
                team: ws.team
            });
        }

        //
        // ⚔️ ATTACK / TAKEOVER (only during raids)
        //
        if (data.type === "attack_chunk") {
            if (!ws.raidMode) return;

            const chunk = getChunk(data.x, data.z);
            const owner = world.claims[chunk];

            if (!owner || owner === ws.team) return;

            world.claims[chunk] = ws.team;

            broadcast({
                type: "chunk_taken",
                chunk,
                newOwner: ws.team
            });
        }

        //
        // 🗺️ REQUEST MAP DATA (for minimap UI later)
        //
        if (data.type === "request_map") {
            ws.send(JSON.stringify({
                type: "map_data",
                claims: world.claims
            }));
        }

        //
        // 💰 UPGRADES (simple economy spending)
        //
        if (data.type === "upgrade") {
            const cost = 10;

            if (economy[ws.team] >= cost) {
                economy[ws.team] -= cost;

                broadcast({
                    type: "upgrade_success",
                    team: ws.team
                });
            }
        }

    });
});
