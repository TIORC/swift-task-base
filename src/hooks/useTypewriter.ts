import { useEffect, useRef, useState } from "react";

/** Pausa curta entre palavras. */
const WORD_PAUSE = 180;
/** Pausa depois de vírgula/ponto — dá a cadência de frase, não de robô. */
const SENTENCE_PAUSE = 240;
/** Intervalo base por caractere. Alto de propósito: o efeito é lento. */
const BASE_DELAY = 60;
/** Variação aleatória por caractere, para o ritmo não ficar mecânico. */
const JITTER = 34;

const PAUSE_CHARS = new Set([".", ",", ";", ":"]);

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function delayFor(char: string) {
  if (PAUSE_CHARS.has(char)) return BASE_DELAY + SENTENCE_PAUSE;
  if (char === " ") return BASE_DELAY + WORD_PAUSE;
  return BASE_DELAY + Math.random() * JITTER;
}

export interface UseTypewriterOptions {
  /** Silêncio antes da primeira letra. */
  startDelay?: number;
  /** Permite desligar o efeito (ex.: enquanto a tela ainda carrega). */
  enabled?: boolean;
}

/**
 * Revela o texto caractere a caractere, num ritmo lento e irregular.
 * Com `prefers-reduced-motion` ligado, devolve o texto completo de uma vez.
 */
export function useTypewriter(text: string, { startDelay = 400, enabled = true }: UseTypewriterOptions = {}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (prefersReducedMotion()) {
      setTyped(text);
      setDone(true);
      return;
    }

    let index = 0;
    setTyped("");
    setDone(false);

    const tick = () => {
      if (index >= text.length) {
        setDone(true);
        return;
      }
      const char = text[index];
      index += 1;
      setTyped(text.slice(0, index));
      timerRef.current = window.setTimeout(tick, delayFor(char));
    };

    timerRef.current = window.setTimeout(tick, startDelay);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [text, startDelay, enabled]);

  return { typed, done };
}
