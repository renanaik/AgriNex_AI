import React, { useState, useEffect } from 'react';
import { Settings, User, Mail, Phone, Globe, LogOut, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function ProfileSettings() {
  const { user, updateProfile, logout } = useAuth();
  const { t, language, switchLanguage } = useLanguage();

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    language_preference: 'en',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        language_preference: user.language_preference || language || 'en',
      });
    }
  }, [user, language]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error(t('form_required'));
      return;
    }

    try {
      setSubmitting(true);
      await updateProfile({
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || null,
        language_preference: formData.language_preference,
      });

      if (formData.language_preference !== language) {
        switchLanguage(formData.language_preference);
      }

      toast.success(t('profile_updated'));
    } catch (err) {
      const msg = err.response?.data?.detail || t('error_occurred');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <Settings size={26} className="title-icon" />
          <div>
            <h1>{t('profile_settings')}</h1>
            <p className="subtitle">{t('monitor_soil')}</p>
          </div>
        </div>
      </div>

      <div className="profile-layout-grid">
        <div className="form-card">
          <div className="profile-card-header">
            <div className="profile-large-avatar">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'F'}
            </div>
            <div>
              <h3>{user?.full_name}</h3>
              <p className="profile-meta-email">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label htmlFor="full_name">{t('full_name')} *</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">{t('email')}</label>
              <div className="input-with-icon disabled-input">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="form-control"
                />
              </div>
              <span className="field-hint">Email address cannot be changed.</span>
            </div>

            <div className="form-group">
              <label htmlFor="phone">{t('phone')}</label>
              <div className="input-with-icon">
                <Phone size={18} className="input-icon" />
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="language_preference">{t('language')}</label>
              <div className="input-with-icon">
                <Globe size={18} className="input-icon" />
                <select
                  id="language_preference"
                  name="language_preference"
                  value={formData.language_preference}
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="en">English</option>
                  <option value="gu">ગુજરાતી</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? (
                  <span className="btn-spinner"></span>
                ) : (
                  <>
                    <Check size={16} /> {t('save')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="account-actions-card">
          <h3>Account Security</h3>
          <p className="account-security-desc">
            Your soil tests, field records, and images are strictly isolated to your account.
          </p>
          <div className="account-meta-box">
            <p>
              <strong>Account ID:</strong> #{user?.id}
            </p>
            <p>
              <strong>Member since:</strong>{' '}
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </p>
          </div>
          <button className="danger-btn logout-action-btn" onClick={logout}>
            <LogOut size={16} /> {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileSettings;

