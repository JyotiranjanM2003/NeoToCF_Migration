import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of inactivity. Keeps the filter input snappy while avoiding a re-render
 * (and potential re-filter over 500+ rows) on every keystroke.
 *
 * Usage:
 *   const debouncedSearch = useDebouncedValue(search, 200);
 *   const visible = rows.filter(r => r.name.includes(debouncedSearch));
 */
export default function useDebouncedValue(value, delayMs = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
