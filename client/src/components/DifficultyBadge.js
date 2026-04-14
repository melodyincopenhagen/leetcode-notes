import React from 'react';

const MAP = {
  Easy:   { color: '#3B6D11', bg: '#EAF3DE', dot: '#5a9848' },
  Medium: { color: '#854F0B', bg: '#FAEEDA', dot: '#c48a28' },
  Hard:   { color: '#A32D2D', bg: '#FCEBEB', dot: '#c85a48' },
};

export default function DifficultyBadge({ difficulty }) {
  const d = MAP[difficulty] || { color: '#888', bg: '#f1efe8', dot: '#aaa' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: d.bg, color: d.color,
      borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.dot, flexShrink: 0 }} />
      {difficulty}
    </span>
  );
}
