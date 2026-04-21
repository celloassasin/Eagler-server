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
const world = {
    claims: {},
    economy: { red: 0, blue: 0 }
};

function chunk(x, z) {
    return `${Math.floor(x / 10)}:${Math.floor(z / 10)}`;
}

function handleRivals(ws, data) {

    // 🟢 TEAM JOIN (permanent)
    if (data.type === "join_team") {
        if (ws.team) return;

        ws.team = data.team;

        ws.send(JSON.stringify({
            type: "team_joined",
            team: ws.team
        }));
    }

    // 🏗️ CLAIM LAND
    if (data.type === "claim") {
        const c = chunk(data.x, data.z);

        world.claims[c] = ws.team;

        broadcast(modes.rivals, {
            type: "claim_update",
            chunk: c,
            team: ws.team
        });
    }

    // ⚔️ RAID MODE
    if (data.type === "raid") {
        ws.raid = true;

        broadcast(modes.rivals, {
            type: "raid_started",
            team: ws.team
        });
    }

    // ⚔️ TAKEOVER
    if (data.type === "attack") {
        if (!ws.raid) return;

        const c = chunk(data.x, data.z);
        const owner = world.claims[c];

        if (!owner || owner === ws.team) return;

        world.claims[c] = ws.team;

        broadcast(modes.rivals, {
            type: "chunk_taken",
            chunk: c,
            team: ws.team
        });
    }

    // 🗺️ MAP REQUEST
    if (data.type === "map") {
        ws.send(JSON.stringify({
            type: "map_data",
            claims: world.claims
        }));
    }
}
function handlePvP(ws, data) {

    if (data.type === "queue") {
        ws.send(JSON.stringify({
            type: "match_found",
            mode: data.mode
        }));
    }

    if (data.type === "hit") {
        ws.send(JSON.stringify({ type: "hit_ok" }));
    }

    if (data.type === "death") {
        ws.send(JSON.stringify({ type: "respawn" }));
    }
}
function handleBedwars(ws, data) {

    if (data.type === "join") {
        ws.team = Math.random() > 0.5 ? "red" : "blue";

        ws.send(JSON.stringify({
            type: "bedwars_joined",
            team: ws.team
        }));
    }

    if (data.type === "break_bed") {
        broadcast(modes.bedwars, {
            type: "bed_broken",
            team: data.team
        });
    }
}
function handleSurvival(ws, data) {

    if (data.type === "spawn") {
        ws.send(JSON.stringify({
            type: "survival_spawn"
        }));
    }
}
