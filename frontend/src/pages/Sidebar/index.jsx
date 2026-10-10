
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MdHealthAndSafety,
  MdPerson,
  MdSearch,
  MdDescription,
  MdSmartToy,
  MdNewspaper,
  MdCalendarMonth,
  MdLogout,
  MdMenu,
  MdClose,
  MdChevronLeft,
  MdChevronRight
} from 'react-icons/md';
import './index.css';

const menuItems = [
  { label: 'You', path: '/', icon: MdPerson },
  { label: 'Resource Finder', path: '/resource-finder', icon: MdSearch },
  { label: 'Report Explanation', path: '/report-explanation', icon: MdDescription },
  { label: 'Chatbot', path: '/chatbot', icon: MdSmartToy },
  { label: 'News', path: '/global-news', icon: MdNewspaper },
  { label: 'Appointment', path: '/appointment', icon: MdCalendarMonth }
];

export default function Sidebar({ ml, setMl }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = ml === 14;

  const toggleSidebar = () => {
    setMl(collapsed ? 64 : 14);
  };

  const logout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/auth', { replace: true });
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        className="hai-mobile-menu"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        <MdMenu size={25} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="hai-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={
          'hai-sidebar ' +
          (collapsed ? 'hai-sidebar-collapsed ' : '') +
          (mobileOpen ? 'hai-sidebar-mobile-open' : '')
        }
      >
        <div className="hai-sidebar-brand">
          <div className="hai-brand-icon">
            <MdHealthAndSafety size={29} />
          </div>

          {!collapsed && (
            <div className="hai-brand-text">
              <h2>HealthAI</h2>
              <span>INTELLIGENT HEALTHCARE</span>
            </div>
          )}

          <button
            type="button"
            className="hai-mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <MdClose size={22} />
          </button>
        </div>

        <div className="hai-sidebar-caption">
          {!collapsed && 'WORKSPACE'}
        </div>

        <nav className="hai-sidebar-nav" aria-label="Main navigation">
          {menuItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                'hai-sidebar-link ' +
                (isActive ? 'hai-sidebar-link-active' : '')
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="hai-sidebar-link-icon">
                <Icon size={22} />
              </span>

              {!collapsed && (
                <span className="hai-sidebar-link-label">
                  {label}
                </span>
              )}

              {!collapsed && path === '/' && (
                <span className="hai-sidebar-home-dot" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hai-sidebar-bottom">
          <div className="hai-sidebar-security">
            <div className="hai-security-icon">
              <MdHealthAndSafety size={21} />
            </div>

            {!collapsed && (
              <div>
                <strong>Your health matters</strong>
                <span>Stay informed, stay healthy.</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="hai-sidebar-logout"
            title={collapsed ? 'Log Out' : undefined}
            onClick={logout}
          >
            <span className="hai-sidebar-link-icon">
              <MdLogout size={22} />
            </span>

            {!collapsed && <span>Log Out</span>}
          </button>

          <button
            type="button"
            className="hai-sidebar-collapse"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <MdChevronRight size={21} />
            ) : (
              <MdChevronLeft size={21} />
            )}

            {!collapsed && <span>Collapse menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
