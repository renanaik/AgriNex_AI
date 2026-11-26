import React from 'react';
import { Menu, Bell, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

function TopHeader({ onToggleSidebar }) {
  const { language, switchLanguage, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
      </div>

      <div className="top-header-right">
        <div className="lang-switcher">
          <Globe size={18} className="lang-icon" />
          <select
            value={language}
            onChange={(e) => switchLanguage(e.target.value)}
            className="lang-select"
            aria-label="Select language"
          >
            <option value="en">English</option>
            <option value="gu">ગુજરાતી</option>
          </select>
        </div>

        <button className="icon-btn" aria-label="Notifications" title={t('notifications')}>
          <Bell size={20} />
        </button>

        <div
          className="profile-badge"
          onClick={() => navigate('/profile')}
          title={user?.full_name || 'Profile'}
        >
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'F'}
        </div>
      </div>
    </header>
  );
}

export default TopHeader;

