import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface UseSpeakOptions {
	rate?: number;
	pitch?: number;
	voice?: SpeechSynthesisVoice;
	onEnd?: () => void;
	/** Use Groq TTS API instead of browser SpeechSynthesis */
	useGroqTts?: boolean;
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
 * A custom hook for text-to-speech.
 *
 * Supports two modes:
 * 1. Browser SpeechSynthesis API (default) — works offline, free
 * 2. Groq TTS API — higher quality voices, requires backend AI service running
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
	const audioElementRef = useRef<HTMLAudioElement | null>(null);
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
			synth.cancel();
			if (audioElementRef.current) {
				audioElementRef.current.pause();
				audioElementRef.current = null;
			}
		};
	}, []);

	// Cleanup audio on unmount
	useEffect(() => {
		return () => {
			if (audioElementRef.current) {
				audioElementRef.current.pause();
				audioElementRef.current.remove();
				audioElementRef.current = null;
			}
		};
	}, []);

	const speakBrowserTTS = useCallback(
		(text: string, options?: UseSpeakOptions) => {
			if (!supported || !window.speechSynthesis) return;

			const synth = window.speechSynthesis;

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = options?.rate ?? 1.0;
			utterance.pitch = options?.pitch ?? 1.0;

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

	const speak = useCallback(
		async (text: string, options?: UseSpeakOptions) => {
			if (!text.trim()) return;

			// Stop any ongoing playback
			if (window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
			if (audioElementRef.current) {
				audioElementRef.current.pause();
				audioElementRef.current.remove();
				audioElementRef.current = null;
			}
			currentUtteranceRef.current = null;

			// Use Groq TTS if requested
			if (options?.useGroqTts) {
				try {
					setSpeaking(true);
					const formData = new FormData();
					formData.append("text", text);
					formData.append("voice", "Fritz-PlayAI");

					// Call backend proxy → AI service TTS
					const response = await api.post<Blob>(
						"/api/tts",
						formData,
						{ raw: true },
					);

					const audioBlob = response as unknown as Blob;
					const audioUrl = URL.createObjectURL(audioBlob);
					const audio = new Audio(audioUrl);
					audioElementRef.current = audio;

					audio.onended = () => {
						URL.revokeObjectURL(audioUrl);
						if (mountedRef.current) {
							setSpeaking(false);
						}
						options?.onEnd?.();
					};

					audio.onerror = () => {
						URL.revokeObjectURL(audioUrl);
						if (mountedRef.current) {
							setSpeaking(false);
						}
					};

					await audio.play();
				} catch {
					// Fall back to browser TTS on error
					if (mountedRef.current) {
						setSpeaking(false);
					}
					if (supported && window.speechSynthesis) {
						speakBrowserTTS(text, options);
					}
				}
				return;
			}

			// Default: use browser SpeechSynthesis
			speakBrowserTTS(text, options);
		},
		[supported, speakBrowserTTS],
	);


	const stop = useCallback(() => {
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
		if (audioElementRef.current) {
			audioElementRef.current.pause();
			audioElementRef.current.remove();
			audioElementRef.current = null;
		}
		currentUtteranceRef.current = null;
		if (mountedRef.current) {
			setSpeaking(false);
			setPaused(false);
		}
	}, []);

	return { speak, stop, speaking, supported, voices, paused };
}