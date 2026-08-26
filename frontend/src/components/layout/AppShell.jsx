import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', enabled: true },
  { to: '/packages', label: 'Packages', enabled: true },
  { to: '/transform-rules', label: 'Transform Rules', enabled: true },
  { to: '/datastores', label: 'Data Stores', enabled: false },
  { to: '/variables', label: 'Variables', enabled: false },
  { to: '/security', label: 'Security Materials', enabled: false },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="dot" />
          MIGRATION CONSOLE
        </div>
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ) : (
            <span key={item.to} className="sidebar-link disabled" title="Coming in a later phase">
              {item.label}
            </span>
          )
        )}
      </aside>
      <main className="main">
        <div className="main-header">
          <div>
            <h1>Neo → Cloud Foundry Migration</h1>
            <p style={{ margin: 0 }}>{user?.email}</p>
          </div>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
