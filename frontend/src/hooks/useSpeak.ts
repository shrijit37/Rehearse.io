import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeakOptions {
	rate?: number;
	pitch?: number;
	voice?: SpeechSynthesisVoice;
	onEnd?: () => void;
}

interface UseSpeakReturn {
	speak: (text: string, options?: UseSpeakOptions) => void;
	stop: () => void;
	speaking: boolean;
	supported: boolean;
	voices: SpeechSynthesisVoice[];
	paused: boolean;
}

/**
 * A custom hook for the browser's SpeechSynthesis API.
 *
 * - Falls back gracefully when SpeechSynthesis is unavailable.
 * - Cancels previous speech when speak() is called again.
 * - Prefers voices matching `navigator.language` (e.g. "en-US").
 *
 * @example
 * const { speak, stop, speaking, supported } = useSpeak();
 * <button onClick={() => speak("Hello, world!")}>Play</button>
 */
export function useSpeak(): UseSpeakReturn {
	const [speaking, setSpeaking] = useState(false);
	const [paused, setPaused] = useState(false);
	const [supported, setSupported] = useState(false);
	const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
	const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		if (typeof window === "undefined" || !window.speechSynthesis) {
			setSupported(false);
			return;
		}

		setSupported(true);

		const synth = window.speechSynthesis;

		// Load voices — they may already be loaded
		const loadVoices = () => {
			const available = synth.getVoices();
			if (available.length > 0) {
				// Sort: preferred language voices first, then the rest
				const lang = navigator.language;
				const sorted = [...available].sort((a, b) => {
					const aMatch = a.lang.startsWith(lang) ? 1 : 0;
					const bMatch = b.lang.startsWith(lang) ? 1 : 0;
					return bMatch - aMatch;
				});
				setVoices(sorted);
			}
		};

		loadVoices();
		synth.addEventListener("voiceschanged", loadVoices);

		return () => {
			mountedRef.current = false;
			synth.removeEventListener("voiceschanged", loadVoices);
			synth.cancel();
		};
	}, []);

	const speak = useCallback(
		(text: string, options?: UseSpeakOptions) => {
			if (!supported || !window.speechSynthesis) return;

			const synth = window.speechSynthesis;

			// Cancel any ongoing speech
			synth.cancel();
			currentUtteranceRef.current = null;

			if (!text.trim()) return;

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = options?.rate ?? 1.0;
			utterance.pitch = options?.pitch ?? 1.0;

			// Use specified voice, or the first one matching our language, or default
			if (options?.voice) {
				utterance.voice = options.voice;
			} else {
				const lang = navigator.language;
				const preferred = voices.find((v) => v.lang.startsWith(lang));
				if (preferred) utterance.voice = preferred;
			}

			utterance.onstart = () => {
				if (mountedRef.current) setSpeaking(true);
			};

			utterance.onend = () => {
				if (mountedRef.current) {
					setSpeaking(false);
					setPaused(false);
				}
				options?.onEnd?.();
			};

			utterance.onerror = () => {
				if (mountedRef.current) {
					setSpeaking(false);
					setPaused(false);
				}
			};

			utterance.onpause = () => {
				if (mountedRef.current) setPaused(true);
			};

			utterance.onresume = () => {
				if (mountedRef.current) setPaused(false);
			};

			currentUtteranceRef.current = utterance;
			synth.speak(utterance);
		},
		[supported, voices],
	);

	const stop = useCallback(() => {
		if (!supported || !window.speechSynthesis) return;
		window.speechSynthesis.cancel();
		currentUtteranceRef.current = null;
		if (mountedRef.current) {
			setSpeaking(false);
			setPaused(false);
		}
	}, [supported]);

	return { speak, stop, speaking, supported, voices, paused };
}
