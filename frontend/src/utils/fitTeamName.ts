// Fits a club name into the scorebug's fixed-width team box without cutting it
// off. One line is preferred, shrunk a little if needed; a name too long for
// that splits over two balanced lines at the largest size that fits. Sizes are
// in the overlay's 1920×1080 canvas pixels.

export interface FittedName {
  lines: string[];
  fontSize: number;
}

const FONT_WEIGHT = 900;
const FONT_FAMILY = 'Arial, sans-serif';
const MAX_SIZE = 24;
const MIN_SINGLE_LINE_SIZE = 20;
const MIN_TWO_LINE_SIZE = 14;

let measureCtx: CanvasRenderingContext2D | null | undefined;

function textWidth(text: string, size: number): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * size * 0.7; // rough fallback if canvas is unavailable
  measureCtx.font = `${FONT_WEIGHT} ${size}px ${FONT_FAMILY}`;
  return measureCtx.measureText(text).width;
}

// The word break that keeps the wider of the two lines as narrow as possible.
function balancedSplit(words: string[]): [string, string] {
  let best: [string, string] = [words.slice(0, 1).join(' '), words.slice(1).join(' ')];
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' ');
    const second = words.slice(i).join(' ');
    const widest = Math.max(textWidth(first, MAX_SIZE), textWidth(second, MAX_SIZE));
    if (widest < bestWidth) {
      bestWidth = widest;
      best = [first, second];
    }
  }
  return best;
}

export function fitTeamName(name: string, maxWidth: number): FittedName {
  const text = name.trim();

  for (let size = MAX_SIZE; size >= MIN_SINGLE_LINE_SIZE; size--) {
    if (textWidth(text, size) <= maxWidth) return { lines: [text], fontSize: size };
  }

  const words = text.split(/\s+/);
  if (words.length > 1) {
    const [first, second] = balancedSplit(words);
    for (let size = MAX_SIZE; size >= MIN_TWO_LINE_SIZE; size--) {
      if (Math.max(textWidth(first, size), textWidth(second, size)) <= maxWidth) {
        return { lines: [first, second], fontSize: size };
      }
    }
    return { lines: [first, second], fontSize: MIN_TWO_LINE_SIZE };
  }

  // A single very long word: smallest one-line size; CSS ellipsis is the last resort.
  return { lines: [text], fontSize: MIN_SINGLE_LINE_SIZE };
}
