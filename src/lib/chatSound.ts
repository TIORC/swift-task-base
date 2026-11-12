/**
 * Som curto de "mensagem nova" gerado com Web Audio (sem arquivo de áudio).
 * O navegador só libera o áudio depois de um gesto do usuário; por isso o
 * contexto é criado/retomado no primeiro clique (ver `primeChatSound`).
 * Qualquer falha é ignorada: o som é um reforço, a pílula já avisa.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Cria/retoma o contexto no primeiro gesto do usuário, para o som tocar depois. */
export function primeChatSound() {
  try {
    const c = getContext();
    if (c && c.state === "suspended") void c.resume();
  } catch {
    /* sem áudio disponível */
  }
}

/** Dois tons curtos em sequência (sobe uma quarta). */
export function playChatSound() {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    const start = c.currentTime;
    const notes: [number, number][] = [
      [880, 0],
      [1320, 0.13],
    ];
    for (const [freq, offset] of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.28);
      osc.connect(gain).connect(c.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.3);
    }
  } catch {
    /* som indisponível: ignora */
  }
}
