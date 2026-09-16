import React from 'react';

/** Search input with a leading magnifier icon. Controlled by the caller. */
export default function SearchField({ value, onChange, placeholder = 'Search…', width }) {
  return (
    <div className="search-field" style={width ? { width } : undefined}>
      <span className="search-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
