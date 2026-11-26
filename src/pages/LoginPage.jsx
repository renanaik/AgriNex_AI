import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Lock, Mail, Globe, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, language, switchLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t('form_required'));
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      toast.success(t('welcome_back'));
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
      {/* Top Header with Language Bar */}
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

      <div className="auth-modal-wrapper">
        {/* Left Side: Brand Value Proposition */}
        <div className="auth-side-banner">
          <div className="banner-content">
            <div className="banner-pill">
              <ShieldCheck size={16} />
              <span>{language === 'gu' ? 'સુરક્ષિત ખેડૂત પોર્ટલ' : 'Secure Agricultural Portal'}</span>
            </div>
            <h2>
              {language === 'gu'
                ? 'જમીન પરીક્ષણ અને પાક વિશ્લેષણ પ્લેટફોર્મ'
                : 'Smart Soil Health & Farm Intelligence'}
            </h2>
            <p className="banner-subtext">
              {language === 'gu'
                ? 'તમારી જમીનના NPK, pH સ્તર અને છબી વિશ્લેષણ દ્વારા પાક ઉત્પાદનમાં વૈજ્ઞાનિક વધારો મેળવો.'
                : 'Monitor real-time soil fertility, track NPK parameters, and unlock OpenCV image processing tailored for your fields.'}
            </p>

            <div className="banner-feature-list">
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'ખેડૂત-વાર સુરક્ષિત અને અલગ ડેટા' : 'Strict Farmer Data Isolation & Privacy'}</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'OpenCV જમીન છબી પ્રક્રિયા' : 'OpenCV CLAHE Soil Texture Processing'}</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="feat-check" />
                <span>{language === 'gu' ? 'પાક અને ખાતર વિશ્લેષણ' : 'Targeted Crop Advisory & Fertilizer Schedules'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h3>{t('welcome_back')}</h3>
            <p className="auth-form-subtext">
              {language === 'gu'
                ? 'તમારા એકાઉન્ટમાં લોગિન કરવા માટે માહિતી દાખલ કરો'
                : 'Sign in to access your farms, soil tests, and reports'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-inner-form" noValidate>
            <div className="form-group">
              <label htmlFor="login-email">{t('email')}</label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-field-icon" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.com"
                  className="auth-input-field"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">{t('password')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-field-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input-field"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="btn-spinner"></span> {t('loading')}
                </>
              ) : (
                <>
                  <span>{t('login')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-form-footer">
            <p>
              {t('no_account')}{' '}
              <Link to="/signup" className="auth-accent-link">
                {t('signup')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
