/**
 * Japanese Text-To-Speech (TTS) Utility
 * Reads Japanese words/sentences using Web Speech API with fallback
 */

export function playJapaneseSpeech(text: string, rate: number = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!text || typeof window === "undefined") {
      resolve();
      return;
    }

    const cleanText = text.trim();
    if (!cleanText) {
      resolve();
      return;
    }

    // 1. Try browser native Web Speech API
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel(); // Stop any pending speech

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "ja-JP";
        utterance.rate = rate; // Natural pace

        // Try to pick a high-quality Japanese voice if available
        const voices = window.speechSynthesis.getVoices();
        const jaVoice = voices.find(
          (v) => v.lang === "ja-JP" || v.lang.startsWith("ja") || v.name.includes("Japanese") || v.name.includes("Kyoko") || v.name.includes("Otoya")
        );
        if (jaVoice) {
          utterance.voice = jaVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => {
          fallbackGoogleTts(cleanText).then(resolve);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn("Web Speech API error, trying fallback:", err);
      }
    }

    // 2. Fallback to Google TTS
    fallbackGoogleTts(cleanText).then(resolve);
  });
}

function fallbackGoogleTts(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const encoded = encodeURIComponent(text);
      const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encoded}`);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
}
