import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ProblemList from './pages/ProblemList';
import ProblemDetail from './pages/ProblemDetail';
import Notes from './pages/Notes';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 24px', height: 48,
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginRight: 16 }}>LeetCode Notes</span>
        <NavItem to="/">题目列表</NavItem>
        <NavItem to="/notes">笔记</NavItem>
      </nav>
      <Routes>
        <Route path="/" element={<ProblemList />} />
        <Route path="/problems/:id" element={<ProblemDetail />} />
        <Route path="/notes" element={<Notes />} />
      </Routes>
    </BrowserRouter>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      style={({ isActive }) => ({
        padding: '6px 12px', borderRadius: 7, textDecoration: 'none',
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        color: isActive ? '#1D9E75' : '#555',
        background: isActive ? '#f0faf5' : 'transparent',
        transition: 'all .15s',
      })}
    >
      {children}
    </NavLink>
  );
}
