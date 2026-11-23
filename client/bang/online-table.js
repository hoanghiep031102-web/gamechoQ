function connectBangTable(onState, onStatus) {
  const roomLabel = document.getElementById('online-room');
  const rematch = document.getElementById('rematch');
  const leave = document.getElementById('leave-online');
  let session = readBangSession();
  let socket;

  function returnToLobby(keepSeat) {
    if (!keepSeat) writeBangSession(null);
    location.replace('../index.html');
  }

  if (!session?.token) {
    returnToLobby(false);
    return () => {};
  }

  roomLabel.textContent = 'Mã phòng ' + session.code;
  roomLabel.hidden = false;
  leave.hidden = false;
  leave.addEventListener('click', () => {
    if (socket?.connected) socket.emit('leaveRoom');
    else returnToLobby(false);
  });
  rematch.addEventListener('click', () => {
    if (socket?.connected) socket.emit('startGame');
  });

  openBangSocket((connection) => {
    socket = connection;
    socket.on('connect', () => {
      onStatus('Đang kết nối với phòng…', true);
      socket.emit('resumeRoom', session);
    });
    socket.on('roomSession', (value) => {
      session = value;
      writeBangSession(value);
    });
    socket.on('roomState', ({ hostId, started, finished, players, solo }) => {
      if (solo) {
        document.getElementById('mode-label').textContent = 'CHƠI VỚI MÁY';
        roomLabel.textContent = 'Bạn và ' + players.filter((player) => player.bot).length + ' máy';
      }
      if (!started) {
        returnToLobby(true);
        return;
      }
      rematch.hidden = !finished || session.seatId !== hostId;
      rematch.disabled = players.length < 4 || players.some((player) => !player.connected);
    });
    socket.on('gameState', onState);
    socket.on('errorMessage', (message) => onStatus(message, false));
    socket.on('disconnect', () => {
      rematch.disabled = true;
      onStatus('Mất kết nối. Đang thử kết nối lại…', true);
    });
    socket.on('connect_error', () => onStatus('Chưa kết nối được máy chủ. Đang thử lại…', true));
    socket.on('resumeFailed', () => returnToLobby(false));
    socket.on('roomLeft', () => returnToLobby(false));
  }, () => onStatus('Không tải được kết nối phòng. Hãy tải lại trang.', true));

  return (action) => {
    if (socket?.connected) socket.emit('gameAction', action);
  };
}
