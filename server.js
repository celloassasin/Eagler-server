const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("BedWars server running");

const matches = new Map();

function createMatch(mode) {
    return {
        mode,
        players: [],
        teams: {
            red: { bed: true, players: [] },
            blue: { bed: true, players: [] }
        }
    };
}

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).slice(2);
    ws.match = null;
    ws.team = null;

    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // JOIN MATCH
        if (data.type === "join_bedwars") {
            const match = createMatch("bedwars");
            matches.set(ws.id, match);

            ws.match = match;

            const team = match.teams.red.players.length <= match.teams.blue.players.length
                ? "red"
                : "blue";

            ws.team = team;
            match.teams[team].players.push(ws);

            ws.send(JSON.stringify({
                type: "joined",
                team
            }));
        }

        // BREAK BED
        if (data.type === "break_bed") {
            const match = ws.match;
            if (!match) return;

            const enemyTeam = ws.team === "red" ? "blue" : "red";
            match.teams[enemyTeam].bed = false;

            broadcast(match, {
                type: "bed_destroyed",
                team: enemyTeam
            });
        }

        // PLAYER DEATH
        if (data.type === "death") {
            const match = ws.match;
            if (!match) return;

            const teamData = match.teams[ws.team];

            if (teamData.bed) {
                ws.send(JSON.stringify({
                    type: "respawn"
                }));
            } else {
                ws.send(JSON.stringify({
                    type: "eliminated"
                }));
            }

            checkWin(match);
        }
    });
});

function broadcast(match, data) {
    for (let team in match.teams) {
        for (let p of match.teams[team].players) {
            p.send(JSON.stringify(data));
        }
    }
}

function checkWin(match) {
    const redAlive = match.teams.red.players.length;
    const blueAlive = match.teams.blue.players.length;

    if (redAlive === 0) {
        broadcast(match, { type: "win", team: "blue" });
    }

    if (blueAlive === 0) {
        broadcast(match, { type: "win", team: "red" });
    }
}
