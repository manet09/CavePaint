/**
 * Utilities for calculating accurate word, character, glyph, and duration estimates
 * for complex scripts like Khmer, as well as Latin and mixed-language scripts.
 */

export interface TextStats {
  /**
   * Estimated word count.
   * Uses native Intl.Segmenter with Khmer + English dictionary segmentation,
   * falling back to Unicode consonant-cluster heuristics for Khmer if unavailable.
   */
  words: number;
  /**
   * Total Unicode character count (codepoints).
   */
  characters: number;
  /**
   * Character count excluding whitespace and zero-width spaces.
   */
  charactersNoSpaces: number;
  /**
   * Visual glyphs / grapheme clusters.
   * In Khmer, base consonant + subscript (coeng) + vowel marks form 1 visual glyph.
   */
  graphemes: number;
  /**
   * Total line count.
   */
  lines: number;
  /**
   * Estimated voiceover narration duration in seconds (~135-140 words/min).
   */
  estimatedDurationSeconds: number;
  /**
   * Formatted duration string (e.g., "45s", "2m 15s", "1h 10m").
   */
  formattedDuration: string;
}

// Cached Intl segmenters
let cachedWordSegmenter: Intl.Segmenter | null = null;
let cachedGraphemeSegmenter: Intl.Segmenter | null = null;
let intlChecked = false;

function getSegmenters() {
  if (!intlChecked) {
    intlChecked = true;
    try {
      if (typeof Intl !== "undefined" && typeof (Intl as any).Segmenter === "function") {
        cachedWordSegmenter = new Intl.Segmenter(["km", "en"], { granularity: "word" });
        cachedGraphemeSegmenter = new Intl.Segmenter(["km", "en"], { granularity: "grapheme" });
      }
    } catch (e) {
      console.warn("Intl.Segmenter not supported in this environment, using fallback:", e);
    }
  }
  return { wordSegmenter: cachedWordSegmenter, graphemeSegmenter: cachedGraphemeSegmenter };
}

/**
 * Format seconds into human readable duration
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

/**
 * Estimate words, characters, graphemes, and voiceover duration
 */
export function estimateTextStats(text: string): TextStats {
  if (!text || !text.trim()) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      graphemes: 0,
      lines: text ? text.split("\n").length : 0,
      estimatedDurationSeconds: 0,
      formattedDuration: "0s",
    };
  }

  // 1. Total Unicode codepoints & stripped characters
  // Using Array.from ensures proper handling of multi-byte codepoints
  const codepoints = Array.from(text);
  const characters = codepoints.length;
  // Strip spaces, newlines, tabs, and Khmer zero-width spaces (\u200B, \uFEFF)
  const charactersNoSpaces = text.replace(/[\s\u200B\uFEFF]+/gu, "").length;
  const lines = text.split("\n").length;

  const { wordSegmenter, graphemeSegmenter } = getSegmenters();

  // 2. Word counting
  let words = 0;
  if (wordSegmenter) {
    try {
      const segments = wordSegmenter.segment(text);
      for (const seg of segments) {
        if (seg.isWordLike) {
          words++;
        }
      }
    } catch {
      words = fallbackWordCount(text);
    }
  } else {
    words = fallbackWordCount(text);
  }

  // 3. Grapheme cluster (visual glyph) counting
  let graphemes = 0;
  if (graphemeSegmenter) {
    try {
      const segments = graphemeSegmenter.segment(text);
      for (const seg of segments) {
        // Only count non-empty / non-whitespace glyphs
        if (seg.segment.trim().length > 0) {
          graphemes++;
        }
      }
    } catch {
      graphemes = fallbackGraphemeCount(text);
    }
  } else {
    graphemes = fallbackGraphemeCount(text);
  }

  // 4. Voiceover narration duration calculation
  // In Khmer / documentary voiceover, standard pace is ~135 words per minute (~2.25 words/sec).
  const wordsPerSecond = 2.25;
  const estimatedDurationSeconds = Math.max(1, Math.round(words / wordsPerSecond));
  const formattedDuration = formatDuration(estimatedDurationSeconds);

  return {
    words,
    characters,
    charactersNoSpaces,
    graphemes,
    lines,
    estimatedDurationSeconds,
    formattedDuration,
  };
}

/**
 * Fallback word counter when Intl.Segmenter is not available.
 * Accurately handles mixed Latin/Khmer text.
 */
function fallbackWordCount(text: string): number {
  // A. Count Latin & other whitespace-separated word tokens
  const nonKhmerText = text.replace(/[\u1780-\u17FF\u19E0-\u19FF]+/gu, " ");
  const latinWords = (nonKhmerText.match(/[\p{L}\p{N}]+/gu) || []).length;

  // B. Count Khmer syllables/words
  // Khmer Unicode block: \u1780-\u17FF.
  // Syllables begin with a base consonant (not preceded by \u17D2 Coeng) or an independent vowel.
  // Average Khmer words contain ~1.8 syllables.
  const khmerMatches = text.match(/[\u1780-\u17FF\u19E0-\u19FF]+/gu) || [];
  let khmerWords = 0;
  for (const block of khmerMatches) {
    const syllableStarts = (block.match(/(?<!\u17D2)[\u1780-\u17A2]|[\u17A3-\u17B3]/g) || []).length;
    // Average 1.8 syllables per word in standard Khmer prose
    khmerWords += Math.max(1, Math.round(syllableStarts / 1.8));
  }

  return latinWords + khmerWords;
}

/**
 * Fallback grapheme (visual glyph) counter.
 */
function fallbackGraphemeCount(text: string): number {
  // Strip whitespace
  const clean = text.replace(/[\s\u200B\uFEFF]+/gu, "");
  // Match a base character followed by any number of combining marks (diacritics, vowels, coeng)
  const matches = clean.match(/\P{M}\p{M}*/gu);
  return matches ? matches.length : clean.length;
}
