import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  TestTube,
  TreePine,
  History,
  Sprout,
  FileText,
  Settings,
  LogOut,
  Leaf,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

function Sidebar({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { logout, user } = useAuth();

  const navItems = [
    { to: '/', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/analyze', label: t('analyze_soil'), icon: FlaskConical },
    { to: '/soil-test', label: t('soil_test'), icon: TestTube },
    { to: '/farms', label: t('my_farms'), icon: TreePine },
    { to: '/history', label: t('soil_history'), icon: History },
    { to: '/crop-advisory', label: t('crop_advisory'), icon: Sprout },
    { to: '/reports', label: t('reports'), icon: FileText },
    { to: '/profile', label: t('profile_settings'), icon: Settings },
  ];

  const handleLinkClick = () => {
    if (window.innerWidth <= 768 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <Leaf size={24} />
            <h2>{t('app_name')}</h2>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.full_name}</span>
                <span className="sidebar-user-email">{user.email}</span>
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

