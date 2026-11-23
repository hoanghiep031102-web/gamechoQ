const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { randomBytes, randomInt } = require("node:crypto");
const { Server } = require("socket.io");
const BangPractice = require("../client/bang/practice-rules");
const applyBangAction = require("../client/bang/game-actions");
const { dealCharacterOffers } = require("../client/bang/characters");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const reconnectGrace = 120_000;

function scheduleBot(room) {
    if (room.botTimer || !room.game || room.game.winner || rooms.get(room.code) !== room) return;
    if (room.players.some((player, index) => !player.bot && !player.socketId && room.game.players[index].health > 0)) return;
    const game = room.game;
    const actor = game.characterChoice?.target ?? game.pending?.target ?? game.active;
    if (!room.players[actor]?.bot) return;
    room.botTimer = setTimeout(() => {
        room.botTimer = null;
        if (rooms.get(room.code) !== room) return;
        if (room.players.some((player, index) => !player.bot && !player.socketId && game.players[index].health > 0)) return;
        game.botStep();
        room.version++;
        publish(room);
    }, 650);
    room.botTimer.unref();
}

app.get("/game.html", (_request, response) => response.redirect("/bang/"));
const publicOnline = process.env.BANG_PUBLIC_ONLINE === "1";
const staticDirectory = path.join(__dirname, publicOnline ? "public-online" : "../client");
if (publicOnline && !existsSync(path.join(staticDirectory, "index.html"))) {
    throw new Error("Run npm run build:public in server/ before starting public online mode.");
}
app.use(express.static(staticDirectory));

function publish(room) {
    const { code, hostId, players, game, draft, version, match } = room;
    const seats = players.map(({ id, name, socketId, bot }) => ({ id, name, connected: Boolean(socketId || bot), bot: Boolean(bot) }));
    io.to(code).emit("roomState", {
        code, hostId, players: seats, solo: Boolean(room.solo), started: Boolean(game), finished: Boolean(game?.winner), notice: room.notice,
        draft: draft ? { ready: draft.picks.size, total: players.length } : null,
    });
    if (draft) {
        players.forEach(({ id, socketId }) => {
            if (socketId) io.sockets.sockets.get(socketId)?.emit("characterOffer", {
                draftId: draft.id, options: draft.offers.get(id), selected: draft.picks.get(id) ?? null,
            });
        });
    }
    if (!game) return;

    const paused = !game.winner && players.some(({ socketId, bot }, index) => !bot && !socketId && game.players[index].health > 0);
    players.forEach(({ socketId }, index) => {
        if (socketId) io.sockets.sockets.get(socketId)?.emit("gameState", { ...game.view(index), version, match, paused });
    });
    scheduleBot(room);
}

function removeSeat(room, seat) {
    clearTimeout(seat.timer);
    room.players = room.players.filter((player) => player !== seat);
    if (room.players.length === 0 || room.players.every((player) => player.bot)) {
        rooms.delete(room.code);
        return;
    }
    if (room.draft || (room.game && !room.game.winner)) {
        room.notice = `${seat.name} đã rời phòng. Chủ phòng có thể bắt đầu lại khi đủ người.`;
    }
    room.game = null;
    room.draft = null;
    if (room.hostId === seat.id) {
        room.hostId = (room.players.find((player) => player.socketId) ?? room.players[0]).id;
    }
    publish(room);
}

function membership(socket) {
    const room = rooms.get(socket.data.roomCode);
    const seat = room?.players.find((player) => player.socketId === socket.id);
    return { room, seat };
}

function leave(socket) {
    const { room, seat } = membership(socket);
    delete socket.data.roomCode;
    if (!seat) return;
    socket.leave(room.code);
    if (room.game && !room.game.winner) {
        seat.socketId = null;
        room.game.forfeit(room.players.indexOf(seat));
        room.version++;
        if (room.hostId === seat.id) room.hostId = room.players.find((player) => player.socketId)?.id ?? seat.id;
        publish(room);
        if (room.players.every((player) => !player.socketId)) rooms.delete(room.code);
        return;
    }
    removeSeat(room, seat);
}

function attach(socket, room, seat) {
    clearTimeout(seat.timer);
    seat.socketId = socket.id;
    socket.data.roomCode = room.code;
    socket.join(room.code);
    socket.emit("roomSession", { code: room.code, token: seat.token, seatId: seat.id });
    publish(room);
}

function enter(socket, room, name) {
    leave(socket);
    const seat = {
        id: randomBytes(12).toString("hex"),
        token: randomBytes(24).toString("hex"),
        name,
    };
    room.players.push(seat);
    room.hostId ??= seat.id;
    room.notice = "";
    attach(socket, room, seat);
}

io.on("connection", (socket) => {
    const error = (message) => socket.emit("errorMessage", message);

    function readName(data) {
        const raw = data?.playerName;
        const name = typeof raw === "string" ? raw.trim() : "";
        if (!name || name.length > 30) error("Tên cần dài từ 1 đến 30 ký tự.");
        return name.length <= 30 ? name : "";
    }

    socket.on("createRoom", (data) => {
        const name = readName(data);
        if (!name) return;
        const seatCount = data?.seatCount ?? 4;
        if (data?.solo === true && (!Number.isInteger(seatCount) || seatCount < 4 || seatCount > 7)) {
            return error("Chọn từ 4 đến 7 người khi chơi với máy.");
        }

        let code;
        do {
            code = randomBytes(3).toString("hex").toUpperCase();
        } while (rooms.has(code));

        const room = { code, players: [], version: 0, match: 0, notice: "", solo: data?.solo === true };
        if (room.solo) {
            for (let i = 1; i < seatCount; i++) room.players.push({ id: randomBytes(12).toString("hex"), name: "Máy " + i, bot: true });
        }
        rooms.set(code, room);
        enter(socket, room, name);
    });

    socket.on("joinRoom", (data) => {
        const name = readName(data);
        if (!name) return;

        const code = typeof data.roomCode === "string" ? data.roomCode.trim().toUpperCase() : "";
        const room = rooms.get(code);
        if (!room) return error("Không tìm thấy phòng. Kiểm tra lại mã.");
        if (room.solo) return error("Đây là ván chơi riêng với máy.");
        if (room.code === socket.data.roomCode) return publish(room);
        if (room.draft || (room.game && !room.game.winner)) return error("Phòng đang chọn nhân vật hoặc đang trong ván.");
        if (room.players.length >= 7) return error("Phòng đã đủ 7 người.");
        room.game = null;
        enter(socket, room, name);
    });

    socket.on("resumeRoom", (data) => {
        const room = rooms.get(data?.code);
        const seat = room?.players.find((player) => player.token === data?.token);
        if (!seat) {
            socket.emit("resumeFailed", "Không khôi phục được ghế. Bạn có thể vào lại bằng mã khi phòng đang chờ.");
            return;
        }
        if (socket.data.roomCode && socket.data.roomCode !== room.code) return;
        if (seat.socketId && seat.socketId !== socket.id) {
            const previous = io.sockets.sockets.get(seat.socketId);
            if (previous) {
                delete previous.data.roomCode;
                previous.leave(room.code);
                previous.emit("resumeFailed", "Ghế này đã được mở trong một tab khác.");
            }
        }
        attach(socket, room, seat);
    });

    socket.on("startGame", () => {
        const { room, seat } = membership(socket);
        if (!seat || room.hostId !== seat.id) return error("Chỉ chủ phòng có thể bắt đầu ván.");
        if (room.draft || (room.game && !room.game.winner)) return;
        room.players = room.players.filter((player) => player.socketId || player.bot);
        if (room.players.length < 4) return error("Cần ít nhất 4 người.");
        if (room.players.some((player) => !player.bot && !player.socketId)) return error("Đợi mọi người kết nối lại trước khi bắt đầu.");

        const offers = dealCharacterOffers(room.players.length);
        room.game = null;
        room.notice = "";
        room.draft = {
            id: randomBytes(12).toString("hex"),
            offers: new Map(room.players.map(({ id }, index) => [id, offers[index]])),
            picks: new Map(),
        };
        for (const player of room.players) {
            if (player.bot) room.draft.picks.set(player.id, room.draft.offers.get(player.id)[randomInt(2)]);
        }
        publish(room);
    });

    socket.on("chooseCharacter", (data) => {
        const { room, seat } = membership(socket);
        const draft = room?.draft;
        if (!seat || !draft || data?.draftId !== draft.id) return error("Lượt chọn nhân vật đã thay đổi.");
        if (draft.picks.has(seat.id)) return;
        if (!draft.offers.get(seat.id).includes(data.character)) return error("Hãy chọn một trong hai nhân vật của bạn.");

        draft.picks.set(seat.id, data.character);
        if (draft.picks.size < room.players.length) {
            publish(room);
            return;
        }

        const sheriff = randomInt(room.players.length);
        room.players = [...room.players.slice(sheriff), ...room.players.slice(0, sheriff)];
        const characters = room.players.map(({ id }) => draft.picks.get(id));
        room.game = new BangPractice(room.players.length, Math.random, room.players.map(({ name }) => name), { characters });
        room.draft = null;
        room.match++;
        room.version++;
        publish(room);
    });

    socket.on("gameAction", (data) => {
        const { room, seat } = membership(socket);
        const game = room?.game;
        if (!seat || !game || game.winner) return error("Ván hiện không nhận thao tác.");
        if (data?.version !== room.version) return error("Trạng thái đã đổi. Hãy thử lại.");
        if (room.players.some(({ socketId, bot }, index) => !bot && !socketId && game.players[index].health > 0)) {
            return error("Ván đang chờ người chơi kết nối lại.");
        }

        const index = room.players.indexOf(seat);
        if (!applyBangAction(game, index, data)) return error("Thao tác không hợp lệ trong lượt hiện tại.");
        room.version++;
        publish(room);
    });

    socket.on("leaveRoom", () => {
        leave(socket);
        socket.emit("roomLeft");
    });

    socket.on("enterTable", () => {
        const { room, seat } = membership(socket);
        if (room?.game && seat) seat.tableTransfer = Date.now() + 10000;
    });

    socket.on("disconnect", () => {
        const { room, seat } = membership(socket);
        if (!seat) return;
        seat.socketId = null;
        if (room.game && seat.tableTransfer > Date.now()) {
            seat.tableTransfer = 0;
            seat.timer = setTimeout(() => {
                if (seat.socketId || rooms.get(room.code) !== room) return;
                room.game.forfeit(room.players.indexOf(seat));
                room.version++;
                if (room.hostId === seat.id) room.hostId = room.players.find((player) => player.socketId)?.id ?? seat.id;
                if (room.players.every((player) => !player.socketId)) rooms.delete(room.code);
                else publish(room);
            }, 10000);
            seat.timer.unref();
            publish(room);
            return;
        }
        if (room.game) {
            room.game.forfeit(room.players.indexOf(seat));
            room.version++;
            if (room.hostId === seat.id) room.hostId = room.players.find((player) => player.socketId)?.id ?? seat.id;
            publish(room);
            if (room.players.every((player) => !player.socketId)) rooms.delete(room.code);
            return;
        }
        seat.timer = setTimeout(() => removeSeat(room, seat), reconnectGrace);
        seat.timer.unref();
        publish(room);
    });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
    console.log(`BANG! — http://localhost:${server.address().port}`);
});
