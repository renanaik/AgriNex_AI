import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Lock, Mail, User, Phone, Globe, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function SignupPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const { t, language, switchLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password) {
      toast.error(t('form_required'));
      return;
    }

    if (formData.password.length < 6) {
      toast.error(t('password_min'));
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error(t('passwords_no_match'));
      return;
    }

    try {
      setLoading(true);
      await signup({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        password: formData.password,
        language_preference: language,
      });
      toast.success(t('create_account'));
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || t('error_occurred');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-container">
      {/* Floating Top Nav */}
      <div className="auth-floating-nav">
        <div className="auth-brand-simple">
          <Leaf size={24} className="brand-leaf-icon" />
          <span className="brand-name-text">AgriNex</span>
        </div>

        <div className="auth-lang-pill">
          <Globe size={16} />
          <select
            value={language}
            onChange={(e) => switchLanguage(e.target.value)}
            className="auth-lang-select"
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="gu">ગુજરાતી</option>
          </select>
        </div>
      </div>

      <div className="auth-modal-wrapper signup-modal-wrapper">
        {/* Left Side: Benefits */}
        <div className="auth-side-banner">
          <div className="banner-content">
            <div className="banner-pill">
              <ShieldCheck size={16} />
              <span>{language === 'gu' ? 'નવું ખેડૂત ખાતું' : 'Farmer Registration'}</span>
            </div>
            <h2>
              {language === 'gu'
                ? 'આધુનિક કૃષિ માટે ડિજિટલ જમીન આરોગ્ય ડેશબોર્ડ'
                : 'Empowering Farmers with Soil Intelligence'}
            </h2>
            <p className="banner-subtext">
              {language === 'gu'
                ? 'તમારી જમીનનું પૃથ્થકરણ સાચવો, ખાતરની યોગ્ય માત્રા જાણો અને ઉત્પાદનમાં વધારો કરો.'
                : 'Join thousands of growers leveraging scientific soil metrics, OpenCV image diagnosis, and targeted fertilizer dosage recommendations.'}
            </p>

            <div className="banner-feature-list">
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'તમામ ખેતરો અને સેમ્પલની હિસ્ટ્રી' : 'Complete Multi-Field Soil Test History'}</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'ઓટોમેટિક હેલ્થ સ્ટેટસ અને રિપોર્ટ' : 'Automated Soil Health Score & Reports'}</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'ગુજરાતી અને અંગ્રેજીમાં ઉપલબ્ધ' : 'Fully Available in Gujarati & English'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Signup Form */}
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h3>{t('create_account')}</h3>
            <p className="auth-form-subtext">
              {language === 'gu'
                ? 'તમારી વિગતો દાખલ કરીને સરળતાથી એકાઉન્ટ બનાવો'
                : 'Create your individual account to manage your farms'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-inner-form" noValidate>
            <div className="form-group">
              <label htmlFor="signup-name">{t('full_name')} *</label>
              <div className="auth-input-wrapper">
                <User size={18} className="auth-field-icon" />
                <input
                  id="signup-name"
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh Patel"
                  className="auth-input-field"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-grid-2 auth-grid-2">
              <div className="form-group">
                <label htmlFor="signup-email">{t('email')} *</label>
                <div className="auth-input-wrapper">
                  <Mail size={18} className="auth-field-icon" />
                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="farmer@example.com"
                    className="auth-input-field"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-phone">{t('phone')} ({t('optional')})</label>
                <div className="auth-input-wrapper">
                  <Phone size={18} className="auth-field-icon" />
                  <input
                    id="signup-phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                    className="auth-input-field"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-grid-2 auth-grid-2">
              <div className="form-group">
                <label htmlFor="signup-pass">{t('password')} *</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-field-icon" />
                  <input
                    id="signup-pass"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className="auth-input-field"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-confirm-pass">{t('confirm_password')} *</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-field-icon" />
                  <input
                    id="signup-confirm-pass"
                    type={showPassword ? 'text' : 'password'}
                    name="confirm_password"
                    required
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    className="auth-input-field"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="auth-aux-row">
              <label className="show-pass-check">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show passwords</span>
              </label>
            </div>

            <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="btn-spinner"></span> {t('loading')}
                </>
              ) : (
                <>
                  <span>{t('signup')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-form-footer">
            <p>
              {t('have_account')}{' '}
              <Link to="/login" className="auth-accent-link">
                {t('login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
