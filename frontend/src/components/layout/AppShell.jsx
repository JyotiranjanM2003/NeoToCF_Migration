import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import TenantRail from './TenantRail.jsx';
import { CONTENT_TYPES, readCachedCounts } from '../../hooks/useConsoleSummary.js';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '◉' },
      { to: '/tenants', label: 'Tenant Connection', icon: '⇄' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/packages', label: 'Packages', icon: '▤', countKey: 'packages' },
      { to: '/datastores', label: 'Data Stores', icon: '▥', countKey: 'datastores' },
      { to: '/variables', label: 'Variables', icon: '◇', countKey: 'variables' },
      { to: '/security', label: 'Security Materials', icon: '⬡', countKey: 'security' },
      { to: '/number-ranges', label: 'Number Ranges', icon: '≡', countKey: 'numberranges' },
    ],
  },
  {
    label: 'Activity',
    items: [{ to: '/migration-report', label: 'Migration Report', icon: '▦' }],
  },
];

const TITLES = {
  '/dashboard': 'Dashboard',
  '/tenants': 'Tenant Connection',
  '/packages': 'Packages',
  '/datastores': 'Data Stores',
  '/variables': 'Variables',
  '/security': 'Security Materials',
  '/number-ranges': 'Number Ranges',
  '/migration-report': 'Migration Report',
};

function pageTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES).find((key) => key !== '/' && pathname.startsWith(key));
  return match ? TITLES[match] : 'Migration Console';
}

/**
 * Application frame: grouped sidebar + sticky top bar + persistent
 * source→target tenant rail.
 *
 * Props:
 *   tenants – optional { source, target }. Pages that already load the
 *             tenant pair (Dashboard, Tenant Connection) pass it so the
 *             rail shows live data; every other page simply omits it and
 *             the rail is hidden rather than firing an extra request.
 */
export default function AppShell({ children, tenants }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Synchronous read of already-cached lists — costs no requests.
  const counts = readCachedCounts();

  return (
    <div className="console">
      <aside className={`console-sidebar${navOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="dot" />
          MIGRATION CONSOLE
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const count = item.countKey ? counts[item.countKey] : null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setNavOpen(false)}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {count?.loaded && count.total > 0 && (
                      <span className="nav-count" title={`${count.migrated} of ${count.total} migrated`}>
                        {count.migrated}/{count.total}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
        </div>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <div className="topbar-row">
            <button
              type="button"
              className="btn nav-toggle"
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="topbar-heading">
              <div className="topbar-crumb">Neo → Cloud Foundry</div>
              <h1 className="topbar-title">{pageTitle(location.pathname)}</h1>
            </div>
            <div className="topbar-right">
              <span className="topbar-user">{user?.email}</span>
              <button className="btn" onClick={logout}>Log out</button>
            </div>
          </div>

          {tenants && <TenantRail source={tenants.source} target={tenants.target} />}
        </header>

        <main className="console-content">{children}</main>
      </div>

      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
    </div>
  );
}
