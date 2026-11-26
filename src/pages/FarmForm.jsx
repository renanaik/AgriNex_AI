import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TreePine, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

const SOIL_TYPES = ['clay', 'sandy', 'loamy', 'silt', 'peaty', 'chalky'];

function FarmForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    farm_name: '',
    field_name: '',
    location: '',
    area: '',
    soil_type: '',
  });

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/api/farms/${id}`)
        .then((res) => {
          const farm = res.data;
          setFormData({
            farm_name: farm.farm_name || '',
            field_name: farm.field_name || '',
            location: farm.location || '',
            area: farm.area !== null && farm.area !== undefined ? farm.area.toString() : '',
            soil_type: farm.soil_type || '',
          });
        })
        .catch((err) => {
          toast.error(err.response?.data?.detail || 'Failed to load farm details');
          navigate('/farms');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.farm_name.trim()) {
      newErrors.farm_name = t('form_required');
    }
    if (formData.area !== '') {
      const a = parseFloat(formData.area);
      if (isNaN(a) || a < 0) {
        newErrors.area = 'Area must be a positive number';
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
      farm_name: formData.farm_name.trim(),
      field_name: formData.field_name.trim() || null,
      location: formData.location.trim() || null,
      area: formData.area !== '' ? parseFloat(formData.area) : null,
      soil_type: formData.soil_type || null,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await api.put(`/api/farms/${id}`, payload);
        toast.success(t('farm_updated'));
      } else {
        await api.post('/api/farms', payload);
        toast.success(t('farm_created'));
      }
      navigate('/farms');
    } catch (err) {
      const msg = err.response?.data?.detail || t('error_occurred');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-link" onClick={() => navigate('/farms')}>
          <ArrowLeft size={18} /> {t('back_to_farms')}
        </button>
        <div className="page-title-group">
          <TreePine size={26} className="title-icon" />
          <div>
            <h1>{isEdit ? t('edit') + ' ' + t('farm_name') : t('add_farm')}</h1>
            <p className="subtitle">{t('monitor_soil')}</p>
          </div>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className={`form-group ${errors.farm_name ? 'has-error' : ''}`}>
              <label htmlFor="farm_name">{t('farm_name')} *</label>
              <input
                type="text"
                id="farm_name"
                name="farm_name"
                required
                value={formData.farm_name}
                onChange={handleChange}
                placeholder="e.g. Green Valley Farm"
                className="form-control"
              />
              {errors.farm_name && <span className="error-message">{errors.farm_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="field_name">{t('field_name')} ({t('optional')})</label>
              <input
                type="text"
                id="field_name"
                name="field_name"
                value={formData.field_name}
                onChange={handleChange}
                placeholder="e.g. North Parcel #2"
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">{t('location')} ({t('optional')})</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Anand, Gujarat"
                className="form-control"
              />
            </div>

            <div className="form-grid-2">
              <div className={`form-group ${errors.area ? 'has-error' : ''}`}>
                <label htmlFor="area">{t('area_acres')} ({t('optional')})</label>
                <input
                  type="number"
                  id="area"
                  name="area"
                  step="0.1"
                  min="0"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="e.g. 5.5"
                  className="form-control"
                />
                {errors.area && <span className="error-message">{errors.area}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="soil_type">{t('soil_type')} ({t('optional')})</label>
                <select
                  id="soil_type"
                  name="soil_type"
                  value={formData.soil_type}
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="">-- {t('select_soil_type')} --</option>
                  {SOIL_TYPES.map((typeKey) => (
                    <option key={typeKey} value={t(typeKey)}>
                      {t(typeKey)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate('/farms')}
              disabled={submitting}
            >
              {t('cancel')}
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? <span className="btn-spinner"></span> : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FarmForm;

