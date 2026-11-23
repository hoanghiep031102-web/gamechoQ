function connectLobby(socket) {
    const get = (id) => document.getElementById(id);
    const nameInput = get("playerName");
    const roomCodeInput = get("roomCodeInput");
    const create = get("createRoomBtn");
    const join = get("joinRoomBtn");
    const bots = get("play-bots");
    const start = get("startGameBtn");
    const room = get("room");
    const status = get("status");
    const draftPanel = get("character-draft");
    const draftOptions = get("draft-options");
    const draftProgress = get("draft-progress");
    let session = readBangSession();
    let offer;
    let submitting = false;

    function renderOffer() {
        if (!offer) return;
        renderCharacterPicker(draftOptions, {
            ...offer, disabled: submitting, assetPath: "bang/assets/characters/",
        }, (character) => {
            if (!socket.connected || submitting) return;
            submitting = true;
            draftOptions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
            socket.emit("chooseCharacter", { character, draftId: offer.draftId });
        });
    }

    function clearOffer() {
        offer = undefined;
        submitting = false;
        draftPanel.hidden = true;
        draftOptions.replaceChildren();
    }

    function saveSession(value) {
        session = value;
        writeBangSession(value);
    }

    function sendRoomRequest(event) {
        const playerName = nameInput.value.trim();
        if (!playerName) {
            status.textContent = "Nhập tên trước khi tạo hoặc vào phòng.";
            nameInput.focus();
            return;
        }
        socket.emit(event, { playerName, roomCode: roomCodeInput.value.trim().toUpperCase() });
    }

    create.addEventListener("click", () => sendRoomRequest("createRoom"));
    bots.addEventListener("click", () => {
        socket.emit("createRoom", {
            playerName: nameInput.value.trim() || "Bạn", solo: true,
            seatCount: Number(get("bot-seat-count").value),
        });
    });
    get("joinRoom").addEventListener("submit", (event) => {
        event.preventDefault();
        sendRoomRequest("joinRoom");
    });
    get("leaveRoomBtn").addEventListener("click", () => socket.emit("leaveRoom"));
    start.addEventListener("click", () => socket.emit("startGame"));

    socket.on("connect", () => {
        create.disabled = join.disabled = bots.disabled = false;
        if (session) {
            status.textContent = "Đang quay lại phòng…";
            socket.emit("resumeRoom", session);
            return;
        }
        status.textContent = "";
    });
    socket.on("connect_error", () => {
        status.textContent = "Chưa kết nối được. Đang thử lại…";
    });
    socket.on("disconnect", () => {
        create.disabled = join.disabled = bots.disabled = true;
        room.hidden = true;
        clearOffer();
        status.textContent = "Mất kết nối. Đang vào lại phòng…";
    });
    socket.on("roomSession", saveSession);
    socket.on("resumeFailed", (message) => {
        saveSession(null);
        room.hidden = true;
        clearOffer();
        status.textContent = message;
    });
    socket.on("roomState", ({ code, players, hostId, started, notice, draft, solo }) => {
        if (started && session?.token && readBangSession()?.token === session.token) {
            socket.emit("enterTable");
            location.replace("/bang/?mode=online");
            return;
        }
        if (solo && !draft && session?.seatId === hostId) socket.emit("startGame");
        room.hidden = false;
        draftPanel.hidden = !draft;
        if (draft) draftProgress.textContent = `Đã chọn xong: ${draft.ready}/${draft.total} người.`;
        else clearOffer();
        get("roomCode").textContent = `Mã phòng ${code} · ${players.length}/7 người`;
        get("playerList").replaceChildren(...players.map(({ id, name, connected }) => {
            const item = document.createElement("li");
            item.textContent = name + (id === hostId ? " · Chủ phòng" : "") + (connected ? "" : " · Mất kết nối");
            return item;
        }));
        start.hidden = session?.seatId !== hostId || started || Boolean(draft);
        start.disabled = players.length < 4 || players.some((player) => !player.connected);
        status.textContent = started ? "Hãy cho phép trang lưu phiên trong trình duyệt để vào ván."
            : notice || (!draft && players.length < 4 ? "Phòng cần ít nhất 4 người để bắt đầu." : "");
    });
    socket.on("characterOffer", (nextOffer) => {
        const newDraft = offer?.draftId !== nextOffer.draftId;
        const changed = newDraft || offer.selected !== nextOffer.selected || submitting;
        offer = nextOffer;
        submitting = false;
        get("draft-title").textContent = offer.selected ? "Bạn đã chọn " + bangCharacters[offer.selected].name : "Chọn một trong hai nhân vật";
        if (changed) renderOffer();
        if (newDraft) draftPanel.scrollIntoView({ block: "nearest" });
    });
    socket.on("roomLeft", () => {
        saveSession(null);
        room.hidden = true;
        clearOffer();
        status.textContent = "Bạn đã rời phòng.";
    });
    socket.on("errorMessage", (message) => {
        status.textContent = message;
        if (submitting) {
            submitting = false;
            renderOffer();
        }
    });
}

const lobbyStatus = document.getElementById("status");
if (location.protocol === "file:") {
    lobbyStatus.textContent = "";
    document.getElementById("open-online").hidden = false;
} else {
    openBangSocket(connectLobby, () => {
        lobbyStatus.textContent = "Không tải được kết nối phòng. Kiểm tra máy chủ BANG! rồi tải lại trang.";
    });
}
