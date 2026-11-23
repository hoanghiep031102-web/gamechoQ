const bangSessionKey = "bang-room-session";

function readBangSession() {
    try {
        return JSON.parse(sessionStorage.getItem(bangSessionKey));
    } catch {
        return null;
    }
}

function writeBangSession(session) {
    try {
        if (session) sessionStorage.setItem(bangSessionKey, JSON.stringify(session));
        else sessionStorage.removeItem(bangSessionKey);
    } catch {
        // Some browser settings block storage.
    }
}

function openBangSocket(onOpen, onError) {
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";
    script.addEventListener("load", () => onOpen(window.io()));
    script.addEventListener("error", onError);
    document.head.append(script);
}
