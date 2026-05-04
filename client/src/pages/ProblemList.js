import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProblems, getRandom, getTags, getStats, getHeatmap, getFavorites,
} from '../api';
import axios from 'axios';
import StatusBadge, { STATUS_MAP } from '../components/StatusBadge';
import DifficultyBadge from '../components/DifficultyBadge';
import { formatDatePT, todayStartPT, ptIsoDate } from '../utils/time';

const STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'none', label: '未做' },
  ...Object.entries(STATUS_MAP).map(([v, s]) => ({ value: v, label: s.label })),
];
const DIFFICULTIES = [
  { value: '', label: '全部难度' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
];
const SORTS = [
  { value: '', label: '按题号' },
  { value: 'title', label: '按标题' },
  { value: 'last_attempt', label: '最近尝试' },
];

const border = '#e0e0e0';
const card = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };

export default function ProblemList() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [tags, setTags] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ difficulty: '', status: '', tag: '', favorite: '', sort: '' });
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [heatmap, setHeatmap] = useState([]);

  const load = useCallback(() => {
    const params = {};
    if (filters.difficulty) params.difficulty = filters.difficulty;
    if (filters.status) params.status = filters.status;
    if (filters.tag) params.tag = filters.tag;
    if (filters.favorite) params.favorite = filters.favorite;
    if (filters.sort) params.sort = filters.sort;
    getProblems(params).then(r => {
      setProblems(r.data);
      // 数据加载完后恢复滚动位置
      const saved = sessionStorage.getItem('problemListScroll');
      if (saved) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
          sessionStorage.removeItem('problemListScroll');
        });
      }
    });
    getTags().then(r => setTags(r.data));
    getFavorites().then(r => setFavorites(r.data));
    getStats().then(r => setStats(r.data));
    getHeatmap().then(r => setHeatmap(r.data));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onShow = (e) => { if (e.persisted) load(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [load]);

  const handleRandom = async () => {
    const params = {};
    if (filters.difficulty) params.difficulty = filters.difficulty;
    if (filters.status) params.status = filters.status;
    if (filters.tag) params.tag = filters.tag;
    if (filters.favorite) params.favorite = filters.favorite;
    try {
      const r = await getRandom(params);
      navigate(`/problems/${r.data.id}`);
    } catch {
      alert('当前筛选条件下没有题目');
    }
  };

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const q = search.trim().toLowerCase();
  const displayedProblems = q
    ? problems.filter(p =>
        String(p.leetcode_id).includes(q) ||
        p.title.toLowerCase().includes(q)
      )
    : problems;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await axios.post('http://localhost:3001/api/sync');
      alert(`同步完成，共 ${r.data.synced} 题`);
      load();
    } catch (e) {
      alert('同步失败：' + (e.response?.data?.error || e.message));
    }
    setSyncing(false);
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

      {/* 顶部标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>我的刷题记录</h1>
        <button onClick={handleSync} disabled={syncing} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          cursor: syncing ? 'default' : 'pointer',
          background: syncing ? '#e0e0e0' : '#1D9E75',
          color: syncing ? '#888' : '#fff',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all .2s',
        }}>
          {syncing ? '同步中...' : '↻ 同步题目'}
        </button>
      </div>

      {/* 统计概览 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
          <StatCard label="总题数" value={stats.total} color="#1a1a1a" />
          <StatCard label="未做" value={stats.untouched} color="#888" />
          {stats.statusCounts.map(s => (
            <StatCard
              key={s.status}
              label={STATUS_MAP[s.status]?.label || s.status}
              value={s.count}
              color={STATUS_MAP[s.status]?.color}
            />
          ))}
        </div>
      )}

      {/* 进度环 + 热力图（同一行） */}
      {(stats?.byDifficulty || heatmap.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, auto) minmax(0, 1fr)',
          gap: 14, marginBottom: 14, alignItems: 'stretch',
        }}>
          {stats?.byDifficulty && <ProgressRing stats={stats} />}
          {heatmap.length > 0 && <Heatmap data={heatmap} />}
        </div>
      )}

      {/* 进度条 */}
      {stats && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 5, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: stats.total > 0 ? `${((stats.total - stats.untouched) / stats.total) * 100}%` : '0%',
              background: '#1D9E75',
              transition: 'width .4s ease',
            }} />
          </div>
        </div>
      )}

      {/* 搜索 + 过滤栏 */}
      <div style={{
        ...card, padding: '14px 16px', marginBottom: 14,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: 13 }}>🔍</span>
          <input
            type="text"
            placeholder="搜索题号或题目名称..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 12px 7px 30px', borderRadius: 7,
              border: `1px solid ${border}`, fontSize: 13, outline: 'none',
              background: '#f9f9f7', color: '#1a1a1a', transition: 'border .15s',
            }}
            onFocus={e => e.target.style.borderColor = '#1D9E75'}
            onBlur={e => e.target.style.borderColor = border}
          />
        </div>

        <div style={{ width: 1, height: 26, background: border, flexShrink: 0 }} />

        <Select options={DIFFICULTIES} value={filters.difficulty} onChange={v => setFilter('difficulty', v)} />
        <Select options={STATUSES} value={filters.status} onChange={v => setFilter('status', v)} />
        <select value={filters.tag} onChange={e => setFilter('tag', e.target.value)} style={selectStyle}>
          <option value="">全部标签</option>
          {tags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
        <select value={filters.favorite} onChange={e => setFilter('favorite', e.target.value)} style={selectStyle}>
          <option value="">全部收藏夹</option>
          {favorites.map(f => <option key={f.id} value={f.name}>★ {f.name} ({f.count})</option>)}
        </select>
        <Select options={SORTS} value={filters.sort} onChange={v => setFilter('sort', v)} />

        <div style={{ width: 1, height: 26, background: border, flexShrink: 0 }} />

        <button onClick={handleRandom} style={{
          padding: '7px 13px', background: '#185FA5', color: '#fff',
          border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13,
          fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          🎲 随机一题
        </button>
      </div>

      {/* 题目数量提示 */}
      {displayedProblems.length > 0 && (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8, paddingLeft: 2 }}>
          显示 {displayedProblems.length} 题{q ? `（搜索"${q}"）` : ''}
        </div>
      )}

      {/* 题目列表 */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {problems.length === 0 ? (
          <EmptyState text="暂无题目，点击右上角「同步题目」按钮从 LeetCode 获取数据" />
        ) : displayedProblems.length === 0 ? (
          <EmptyState text={`没有找到与"${q}"匹配的题目`} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {['#', '题目', '难度', '状态', '标签', '最近尝试'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: i === 0 ? 'center' : 'left',
                    fontSize: 11, fontWeight: 600, color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: '#fafafa',
                    width: i === 0 ? 60 : i === 1 ? 'auto' : i === 2 ? 88 : i === 3 ? 120 : i === 4 ? 180 : 96,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedProblems.map((p, i) => (
                <ProblemRow
                  key={p.id}
                  p={p}
                  last={i === displayedProblems.length - 1}
                  onClick={() => {
                    sessionStorage.setItem('problemListScroll', window.scrollY);
                    navigate(`/problems/${p.id}`);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProblemRow({ p, last, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: last ? 'none' : `1px solid ${border}`,
        background: hover ? '#fafafa' : '#fff',
        cursor: 'pointer', transition: 'background .1s',
      }}
    >
      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#bbb', fontSize: 13, fontWeight: 500 }}>
        {p.leetcode_id}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: hover ? '#185FA5' : '#1a1a1a', transition: 'color .1s' }}>
          {p.title}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <DifficultyBadge difficulty={p.difficulty} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={p.status} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        {((p.tags && p.tags.length > 0) || (p.favorites && p.favorites.length > 0)) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {p.favorites && p.favorites.map(f => (
              <span key={'f-' + f} style={{
                background: '#fff4d6', color: '#9a6b00',
                borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500,
              }}>★ {f}</span>
            ))}
            {p.tags && p.tags.map(t => <Tag key={t} name={t} />)}
          </div>
        )}
      </td>
      <td style={{ padding: '12px 16px', color: '#bbb', fontSize: 12, whiteSpace: 'nowrap' }}>
        {p.attempted_at ? formatDatePT(p.attempted_at) : '—'}
      </td>
    </tr>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 34, marginBottom: 12 }}>📭</div>
      <div style={{ color: '#888', fontSize: 14 }}>{text}</div>
    </div>
  );
}

function Select({ options, value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Tag({ name }) {
  return (
    <span style={{
      background: '#f1efe8', color: '#555',
      borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500,
    }}>#{name}</span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '10px 12px',
      border: `0.5px solid ${border}`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: color || '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const selectStyle = {
  padding: '6px 10px', borderRadius: 7, border: `1px solid ${border}`,
  fontSize: 13, cursor: 'pointer', outline: 'none',
  background: '#f9f9f7', color: '#333',
};

function ProgressRing({ stats }) {
  const { byDifficulty, total, solved, attempting } = stats;
  const easy = byDifficulty.Easy;
  const med = byDifficulty.Medium;
  const hard = byDifficulty.Hard;

  // SVG 圆环参数
  const size = 170;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270° 弧（缺口在底部），起点左下
  const arcSpan = 270;
  const startAngle = 135; // 角度从 12 点顺时针；135° = 左下
  const circ = 2 * Math.PI * r;
  const fullArcLen = circ * (arcSpan / 360);

  const easyTotal = easy.total || 1;
  const medTotal = med.total || 1;
  const hardTotal = hard.total || 1;

  // 三段平均分配 270° 弧 —— 每段表示一个难度，填充比例 = solved/total
  const segLen = fullArcLen / 3;
  const segs = [
    { color: '#1D9E75', total: easy.total, solved: easy.solved, ratio: easy.solved / easyTotal },
    { color: '#F1A62A', total: med.total, solved: med.solved, ratio: med.solved / medTotal },
    { color: '#E5474B', total: hard.total, solved: hard.solved, ratio: hard.solved / hardTotal },
  ];

  // 把弧度转 SVG path（沿圆顺时针绘制弧）
  const angleToXY = (deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  // 端点小圆（在每段填充结尾处）
  const endpointAt = (segIdx, ratio) => {
    const segStart = startAngle + segIdx * (arcSpan / 3);
    const a = segStart + (arcSpan / 3) * Math.min(Math.max(ratio, 0), 1);
    return angleToXY(a);
  };

  return (
    <div style={{
      ...card, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
    }}>
      {/* 圆环 */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size}>
          {/* 背景三段 */}
          {segs.map((s, i) => {
            const segStart = startAngle + i * (arcSpan / 3);
            const segEnd = segStart + (arcSpan / 3) - 4; // 段间留 4° 间隙
            const [x1, y1] = angleToXY(segStart);
            const [x2, y2] = angleToXY(segEnd);
            const large = (segEnd - segStart) > 180 ? 1 : 0;
            return (
              <path
                key={'bg' + i}
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                fill="none"
                stroke={s.color + '33'}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            );
          })}
          {/* 填充三段 */}
          {segs.map((s, i) => {
            const segStart = startAngle + i * (arcSpan / 3);
            const fillSpan = (arcSpan / 3 - 4) * Math.min(Math.max(s.ratio, 0), 1);
            if (fillSpan <= 0) return null;
            const segEnd = segStart + fillSpan;
            const [x1, y1] = angleToXY(segStart);
            const [x2, y2] = angleToXY(segEnd);
            const large = fillSpan > 180 ? 1 : 0;
            return (
              <path
                key={'fg' + i}
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            );
          })}
          {/* 端点小圆点 */}
          {segs.map((s, i) => {
            if (s.ratio <= 0) return null;
            const [px, py] = endpointAt(i, s.ratio);
            return <circle key={'dot' + i} cx={px} cy={py} r={4} fill={s.color} />;
          })}
        </svg>
        {/* 中心文字 */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>
            {solved}<span style={{ fontSize: 13, fontWeight: 500, color: '#888' }}>/{total}</span>
          </div>
          <div style={{ fontSize: 12, color: '#1D9E75', marginTop: 2, fontWeight: 600 }}>
            ✓ Solved
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 12 }}>
            <span style={{ fontWeight: 600, color: '#555' }}>{attempting}</span> Attempting
          </div>
        </div>
      </div>

      {/* 三个难度卡片 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DifficultyTile label="Easy" color="#1D9E75" solved={easy.solved} total={easy.total} />
        <DifficultyTile label="Med." color="#F1A62A" solved={med.solved} total={med.total} />
        <DifficultyTile label="Hard" color="#E5474B" solved={hard.solved} total={hard.total} />
      </div>
    </div>
  );
}

function DifficultyTile({ label, color, solved, total }) {
  return (
    <div style={{
      background: '#fafafa', borderRadius: 10, padding: '12px 22px',
      minWidth: 96, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a1a1a', marginTop: 4, fontWeight: 600 }}>
        {solved}/{total}
      </div>
    </div>
  );
}

function Heatmap({ data }) {
  // 构建日期 -> 次数的映射
  const countMap = {};
  let maxCount = 0;
  for (const { day, count } of data) {
    countMap[day] = count;
    if (count > maxCount) maxCount = count;
  }

  // 固定范围：2026-04-01 ~ 2027-04-01
  const end = new Date('2027-04-01T00:00:00');

  // 从 2026-04-01 所在周的周日开始
  const startDate = new Date('2026-04-01T00:00:00');
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // 今天（太平洋时间，自动处理 PST/PDT）
  const todayPT = todayStartPT();

  // 生成所有天，按列（每列=一周）组织
  const weeks = [];
  const cur = new Date(startDate);
  while (cur <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = ptIsoDate(cur);
      const beforeStart = cur < new Date('2026-04-01T00:00:00');
      const isFuture = cur > todayPT;
      week.push({ date: iso, count: countMap[iso] || 0, future: isFuture, faded: beforeStart });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // 月份标签
  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const firstDay = week[0].date;
    const d = new Date(firstDay);
    if (d.getDate() <= 7) {
      monthLabels.push({ wi, label: d.toLocaleString('zh-CN', { month: 'short' }) });
    }
  });

  const cellSize = 11;
  const cellGap = 3;
  const step = cellSize + cellGap;

  function cellColor(count, future, faded) {
    if (future || faded || count === 0) return '#ebedf0';
    if (maxCount === 0) return '#ebedf0';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return '#9be9a8';
    if (ratio <= 0.5) return '#40c463';
    if (ratio <= 0.75) return '#30a14e';
    return '#216e39';
  }

  const [tooltip, setTooltip] = useState(null);

  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10 }}>提交热力图</div>
      <div style={{ overflowX: 'auto' }}>
        <svg
          width={weeks.length * step}
          height={7 * step + 20}
          style={{ display: 'block' }}
        >
          {/* 月份标签 */}
          {monthLabels.map(({ wi, label }) => (
            <text key={wi} x={wi * step} y={9} fontSize={9} fill="#888">{label}</text>
          ))}
          {/* 格子 */}
          {weeks.map((week, wi) =>
            week.map((cell, di) => (
              <rect
                key={cell.date}
                x={wi * step}
                y={di * step + 14}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={cellColor(cell.count, cell.future, cell.faded)}
                onMouseEnter={e => {
                  const rect = e.target.getBoundingClientRect();
                  setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 6, date: cell.date, count: cell.count });
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: cell.count > 0 ? 'default' : 'default' }}
              />
            ))
          )}
        </svg>
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 5,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 9999,
        }}>
          {tooltip.date}：{tooltip.count} 次提交
        </div>
      )}
      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: '#888' }}>少</span>
        {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map(c => (
          <div key={c} style={{ width: cellSize, height: cellSize, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 10, color: '#888' }}>多</span>
      </div>
    </div>
  );
}
