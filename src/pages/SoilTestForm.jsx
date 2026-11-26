import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TestTube, TreePine, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

function SoilTestForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [farms, setFarms] = useState([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    farm_id: '',
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    ph: '',
    organic_matter: '',
    moisture: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    api
      .get('/api/farms')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setFarms(res.data);
          if (res.data.length > 0) {
            setFormData((prev) => ({ ...prev, farm_id: res.data[0].id.toString() }));
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load farms', err);
      })
      .finally(() => setLoadingFarms(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    // Nitrogen (0 - 500)
    if (formData.nitrogen === '') {
      newErrors.nitrogen = t('form_required');
    } else {
      const n = parseFloat(formData.nitrogen);
      if (isNaN(n) || n < 0 || n > 500) {
        newErrors.nitrogen = 'Nitrogen must be between 0 and 500 mg/kg';
      }
    }

    // Phosphorus (0 - 500)
    if (formData.phosphorus === '') {
      newErrors.phosphorus = t('form_required');
    } else {
      const p = parseFloat(formData.phosphorus);
      if (isNaN(p) || p < 0 || p > 500) {
        newErrors.phosphorus = 'Phosphorus must be between 0 and 500 mg/kg';
      }
    }

    // Potassium (0 - 500)
    if (formData.potassium === '') {
      newErrors.potassium = t('form_required');
    } else {
      const k = parseFloat(formData.potassium);
      if (isNaN(k) || k < 0 || k > 500) {
        newErrors.potassium = 'Potassium must be between 0 and 500 mg/kg';
      }
    }

    // Soil pH (0 - 14)
    if (formData.ph === '') {
      newErrors.ph = t('form_required');
    } else {
      const ph = parseFloat(formData.ph);
      if (isNaN(ph) || ph < 0 || ph > 14) {
        newErrors.ph = 'Soil pH must be between 0 and 14';
      }
    }

    // Organic Matter (0 - 100 optional)
    if (formData.organic_matter !== '') {
      const om = parseFloat(formData.organic_matter);
      if (isNaN(om) || om < 0 || om > 100) {
        newErrors.organic_matter = 'Organic Matter must be between 0 and 100%';
      }
    }

    // Moisture (0 - 100 optional)
    if (formData.moisture !== '') {
      const m = parseFloat(formData.moisture);
      if (isNaN(m) || m < 0 || m > 100) {
        newErrors.moisture = 'Moisture must be between 0 and 100%';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    const payload = {
      farm_id: formData.farm_id ? parseInt(formData.farm_id, 10) : null,
      nitrogen: parseFloat(formData.nitrogen),
      phosphorus: parseFloat(formData.phosphorus),
      potassium: parseFloat(formData.potassium),
      ph: parseFloat(formData.ph),
      organic_matter: formData.organic_matter !== '' ? parseFloat(formData.organic_matter) : null,
      moisture: formData.moisture !== '' ? parseFloat(formData.moisture) : null,
      notes: formData.notes.trim() || null,
    };

    try {
      setSubmitting(true);
      await api.post('/api/soil-tests', payload);
      toast.success(t('soil_test_submitted'));
      navigate('/history');
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
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> {t('back_to_farms') || 'Back'}
        </button>
        <div className="page-title-group">
          <TestTube size={26} className="title-icon" />
          <div>
            <h1>{t('soil_test')}</h1>
            <p className="subtitle">{t('monitor_soil')}</p>
          </div>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} noValidate>
          {/* Farm Selection */}
          <div className="form-section">
            <h3 className="section-title">
              <TreePine size={18} /> {t('select_farm')}
            </h3>
            <div className="form-group">
              <label htmlFor="farm_id">{t('farm_name')}</label>
              {loadingFarms ? (
                <p className="hint-text">{t('loading')}</p>
              ) : farms.length === 0 ? (
                <div className="no-farms-alert">
                  <p>{t('no_farms')}</p>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigate('/farms/new')}
                  >
                    + {t('add_farm')}
                  </button>
                </div>
              ) : (
                <select
                  id="farm_id"
                  name="farm_id"
                  value={formData.farm_id}
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="">-- {t('select_farm')} ({t('optional')}) --</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.farm_name} {farm.field_name ? `(${farm.field_name})` : ''}
                      {farm.location ? ` - ${farm.location}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Primary Nutrients (NPK) */}
          <div className="form-section">
            <h3 className="section-title">{t('soil_test')}</h3>

            <div className="form-grid-3">
              {/* Nitrogen */}
              <div className={`form-group ${errors.nitrogen ? 'has-error' : ''}`}>
                <label htmlFor="nitrogen">
                  {t('nitrogen')} * <span className="unit-badge">{t('mg_kg')}</span>
                </label>
                <input
                  type="number"
                  id="nitrogen"
                  name="nitrogen"
                  step="any"
                  min="0"
                  max="500"
                  value={formData.nitrogen}
                  onChange={handleChange}
                  placeholder="e.g. 140"
                  className="form-control"
                />
                <span className="field-hint">{t('nitrogen_desc')}</span>
                {errors.nitrogen && <span className="error-message">{errors.nitrogen}</span>}
              </div>

              {/* Phosphorus */}
              <div className={`form-group ${errors.phosphorus ? 'has-error' : ''}`}>
                <label htmlFor="phosphorus">
                  {t('phosphorus')} * <span className="unit-badge">{t('mg_kg')}</span>
                </label>
                <input
                  type="number"
                  id="phosphorus"
                  name="phosphorus"
                  step="any"
                  min="0"
                  max="500"
                  value={formData.phosphorus}
                  onChange={handleChange}
                  placeholder="e.g. 45"
                  className="form-control"
                />
                <span className="field-hint">{t('phosphorus_desc')}</span>
                {errors.phosphorus && <span className="error-message">{errors.phosphorus}</span>}
              </div>

              {/* Potassium */}
              <div className={`form-group ${errors.potassium ? 'has-error' : ''}`}>
                <label htmlFor="potassium">
                  {t('potassium')} * <span className="unit-badge">{t('mg_kg')}</span>
                </label>
                <input
                  type="number"
                  id="potassium"
                  name="potassium"
                  step="any"
                  min="0"
                  max="500"
                  value={formData.potassium}
                  onChange={handleChange}
                  placeholder="e.g. 210"
                  className="form-control"
                />
                <span className="field-hint">{t('potassium_desc')}</span>
                {errors.potassium && <span className="error-message">{errors.potassium}</span>}
              </div>
            </div>

            <div className="form-grid-3">
              {/* pH */}
              <div className={`form-group ${errors.ph ? 'has-error' : ''}`}>
                <label htmlFor="ph">
                  {t('soil_ph')} * <span className="unit-badge">0-14</span>
                </label>
                <input
                  type="number"
                  id="ph"
                  name="ph"
                  step="0.1"
                  min="0"
                  max="14"
                  value={formData.ph}
                  onChange={handleChange}
                  placeholder="e.g. 6.8"
                  className="form-control"
                />
                <span className="field-hint">{t('ph_desc')}</span>
                {errors.ph && <span className="error-message">{errors.ph}</span>}
              </div>

              {/* Organic Matter */}
              <div className={`form-group ${errors.organic_matter ? 'has-error' : ''}`}>
                <label htmlFor="organic_matter">
                  {t('organic_matter')} <span className="unit-badge">{t('percent')}</span>
                </label>
                <input
                  type="number"
                  id="organic_matter"
                  name="organic_matter"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.organic_matter}
                  onChange={handleChange}
                  placeholder="e.g. 3.2"
                  className="form-control"
                />
                <span className="field-hint">{t('organic_matter_desc')}</span>
                {errors.organic_matter && (
                  <span className="error-message">{errors.organic_matter}</span>
                )}
              </div>

              {/* Moisture */}
              <div className={`form-group ${errors.moisture ? 'has-error' : ''}`}>
                <label htmlFor="moisture">
                  {t('moisture')} <span className="unit-badge">{t('percent')}</span>
                </label>
                <input
                  type="number"
                  id="moisture"
                  name="moisture"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.moisture}
                  onChange={handleChange}
                  placeholder="e.g. 22"
                  className="form-control"
                />
                <span className="field-hint">{t('moisture_desc')}</span>
                {errors.moisture && <span className="error-message">{errors.moisture}</span>}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">
                {t('notes')} ({t('optional')})
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Observed conditions, crop rotation notes, etc."
                className="form-control"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              {t('cancel')}
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? <span className="btn-spinner"></span> : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SoilTestForm;

