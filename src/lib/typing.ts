/** Скорость «печати»: как читает средний человек (~230 слов в минуту), но длинные ответы ускоряются, чтобы не ждать дольше ~12 секунд */
export const WORDS_PER_MIN = 230;
export const MAX_TOTAL_MS = 12000;
export const MIN_WORD_MS = 70;
export function tokens(text: string): string[] { return text.match(/\S+\s*/g) ?? [text]; }
export function msPerWord(wordCount: number): number {
  const natural = 60000 / WORDS_PER_MIN;
  return Math.max(MIN_WORD_MS, Math.min(natural, MAX_TOTAL_MS / Math.max(1, wordCount)));
}
export function totalMs(text: string): number { const n = tokens(text).length; return Math.round(n * msPerWord(n)); }
