const bangAudio = (() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context;
  let output;
  let paper;
  let blast;
  let waitingCards = 0;
  let waitingNotice;
  let lastNoticeTime = -1;

  const noticeNotes = {
    danger: [[340, 0, .12], [220, .105, .19]],
    success: [[523, 0, .10], [659, .085, .11], [784, .17, .17]],
    info: [[440, 0, .10], [554, .075, .12]],
    heal: [[392, 0, .22], [587, .07, .24], [784, .15, .31], [1175, .21, .24]],
    turn: [[494, 0, .11], [740, .09, .18]],
  };

  function clickSound(time) {
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(590, time);
    tone.frequency.exponentialRampToValueAtTime(235, time + .035);
    volume.gain.setValueAtTime(.10, time);
    volume.gain.exponentialRampToValueAtTime(.001, time + .045);
    tone.connect(volume).connect(output);
    tone.start(time);
    tone.stop(time + .05);
  }

  function cardSound(time) {
    if (!paper) {
      paper = context.createBuffer(1, Math.ceil(context.sampleRate * .14), context.sampleRate);
      const samples = paper.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    source.buffer = paper;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, time);
    filter.frequency.exponentialRampToValueAtTime(660, time + .12);
    volume.gain.setValueAtTime(.001, time);
    volume.gain.exponentialRampToValueAtTime(.20, time + .016);
    volume.gain.exponentialRampToValueAtTime(.001, time + .135);
    source.connect(filter).connect(volume).connect(output);
    source.start(time);
  }

  function flushCards(delay = 0) {
    if (context?.state !== 'running') return;
    const count = waitingCards;
    waitingCards = 0;
    for (let index = 0; index < count; index++) cardSound(context.currentTime + delay + index * .065);
  }

  function explosion() {
    if (context?.state !== 'running') return;
    const time = context.currentTime;
    if (!blast) {
      blast = context.createBuffer(1, Math.ceil(context.sampleRate * .65), context.sampleRate);
      const samples = blast.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = blast;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, time);
    filter.frequency.exponentialRampToValueAtTime(150, time + .48);
    const crack = context.createGain();
    crack.gain.setValueAtTime(.45, time);
    crack.gain.exponentialRampToValueAtTime(.001, time + .62);
    noise.connect(filter).connect(crack).connect(output);
    noise.start(time);

    const boom = context.createOscillator();
    const bass = context.createGain();
    boom.frequency.setValueAtTime(125, time);
    boom.frequency.exponentialRampToValueAtTime(42, time + .3);
    bass.gain.setValueAtTime(.23, time);
    bass.gain.exponentialRampToValueAtTime(.001, time + .52);
    boom.connect(bass).connect(output);
    boom.start(time);
    boom.stop(time + .55);
  }

  function flushNotice(delay = 0) {
    if (context?.state !== 'running' || !waitingNotice) return;
    const toneName = waitingNotice;
    const notes = noticeNotes[toneName];
    waitingNotice = undefined;
    const time = context.currentTime + delay;
    if (toneName !== 'heal' && time - lastNoticeTime < .15) return;
    lastNoticeTime = time;
    for (const [frequency, offset, length] of notes) {
      const start = time + offset;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(frequency, start);
      volume.gain.setValueAtTime(.001, start);
      volume.gain.exponentialRampToValueAtTime(.075, start + .012);
      volume.gain.exponentialRampToValueAtTime(.001, start + length);
      tone.connect(volume).connect(output);
      tone.start(start);
      tone.stop(start + length + .01);
    }
  }

  function playClick() {
    if (!Audio) return;
    try {
      if (!context) {
        context = new Audio();
        output = context.createGain();
        output.connect(context.destination);
      }
      const play = () => {
        if (context.state !== 'running') return;
        clickSound(context.currentTime);
        flushNotice(.055);
        flushCards(.09);
      };
      if (context.state === 'running') play();
      else context.resume().then(play).catch(() => {});
    } catch {
      // Sound is optional on devices without a usable audio output.
    }
  }

  document.addEventListener('click', (event) => {
    const control = event.target.closest?.('button, .practice-link');
    if (control && !control.disabled) playClick();
  }, true);

  return {
    explosion,
    duelShot() {
      if (context?.state !== 'running') return;
      const time = context.currentTime;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(185, time);
      tone.frequency.exponentialRampToValueAtTime(42, time + .12);
      volume.gain.setValueAtTime(.23, time);
      volume.gain.exponentialRampToValueAtTime(.001, time + .15);
      tone.connect(volume).connect(output);
      tone.start(time);
      tone.stop(time + .16);
    },
    deal(count) {
      if (!Audio || count < 1) return;
      waitingCards = Math.min(count, 7);
      flushCards();
    },
    notice(tone) {
      if (!Audio) return;
      waitingNotice = noticeNotes[tone] ? tone : 'info';
      flushNotice();
    },
    clearNotice() {
      waitingNotice = undefined;
    },
  };
})();
