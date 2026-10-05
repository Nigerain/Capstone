import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Runs before the next keystroke's effect: cancels the old timer,
    // so only the last keystroke's timer ever finishes.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}