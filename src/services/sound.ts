// Web Audio API Sound Generator for Hospital Alerts

let audioCtx: AudioContext | null = null;
let sirenInterval: number | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Ensure audio context is ready after user interaction
export function initAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {
    console.warn('Audio initialization warning:', e);
  }
}

// Single doctor alert beep pattern (urgent hospital beep)
export function playDoctorAlertChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Dual-tone urgent beep: 880Hz -> 1760Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1320, now + 0.1);
    osc1.frequency.setValueAtTime(1760, now + 0.2);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.55);

    // Second pulse
    setTimeout(() => {
      try {
        if (!audioCtx) return;
        const now2 = audioCtx.currentTime;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1760, now2);
        gain2.gain.setValueAtTime(0.3, now2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.4);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now2);
        osc2.stop(now2 + 0.45);
      } catch {
        // ignore
      }
    }, 200);
  } catch (err) {
    console.warn('Cannot play doctor chime:', err);
  }
}

// Continuous loud hospital siren for Nurse Station Kiosk
export function startNurseStationSiren() {
  if (sirenInterval !== null) return; // already playing

  try {
    const ctx = getAudioContext();

    const playSirenBurst = () => {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        // Swoop up and down 600Hz -> 1000Hz -> 600Hz
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1050, now + 0.35);
        osc.frequency.linearRampToValueAtTime(600, now + 0.7);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.35);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.75);
      } catch (e) {
        console.warn('Siren burst failed:', e);
      }
    };

    playSirenBurst();
    sirenInterval = window.setInterval(playSirenBurst, 800);
  } catch (err) {
    console.warn('Cannot start nurse station siren:', err);
  }
}

// Stop continuous siren
export function stopNurseStationSiren() {
  if (sirenInterval !== null) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (sirenOscillator) {
    try {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
    } catch {
      // ignore
    }
    sirenOscillator = null;
  }
}

// Soft pleasant confirmation sound when alert is acknowledged
export function playAcknowledgeChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + index * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.55);
    });
  } catch (err) {
    console.warn('Cannot play acknowledge chime:', err);
  }
}
