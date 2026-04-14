import React from 'react';

export const STATUS_MAP = {
  forgotten:   { label: '完全忘记', color: '#A32D2D', bg: '#FCEBEB' },
  know_idea:   { label: '记得思路', color: '#C47800', bg: '#FEF3D0' },
  minor_error: { label: '有小错误', color: '#2563A8', bg: '#E0EDFB' },
  perfect:     { label: '完全掌握', color: '#1D9E75', bg: '#E6F7F2' },
};

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[status];
  if (!s) return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#f1efe8', color: '#888',
      borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 500,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#bbb', flexShrink: 0 }} />
      未做
    </span>
  );
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
