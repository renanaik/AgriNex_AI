import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreePine, Plus, MapPin, Layers, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

function MyFarms() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/farms');
      setFarms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch farms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${t('confirm_delete')} "${name}"?`)) {
      return;
    }

    try {
      setDeletingId(id);
      await api.delete(`/api/farms/${id}`);
      toast.success(t('farm_deleted'));
      setFarms((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete farm');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header-flex">
        <div className="page-title-group">
          <TreePine size={26} className="title-icon" />
          <div>
            <h1>{t('my_farms')}</h1>
            <p className="subtitle">{t('monitor_soil')}</p>
          </div>
        </div>

        <button
          className="primary-btn header-action-btn"
          onClick={() => navigate('/farms/new')}
        >
          <Plus size={18} /> {t('add_farm')}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      ) : farms.length === 0 ? (
        <div className="empty-state-card">
          <TreePine size={48} className="empty-state-icon" />
          <h3>{t('no_farms')}</h3>
          <p>{t('monitor_soil')}</p>
          <button
            className="primary-btn inline-btn"
            onClick={() => navigate('/farms/new')}
          >
            + {t('add_farm')}
          </button>
        </div>
      ) : (
        <div className="farms-grid">
          {farms.map((farm) => (
            <div key={farm.id} className="farm-card">
              <div className="farm-card-header">
                <div>
                  <h3 className="farm-card-title">{farm.farm_name}</h3>
                  {farm.field_name && (
                    <span className="farm-card-field">{farm.field_name}</span>
                  )}
                </div>
                <div className="farm-card-actions">
                  <button
                    className="action-icon-btn edit-btn"
                    onClick={() => navigate(`/farms/${farm.id}/edit`)}
                    title={t('edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="action-icon-btn delete-btn"
                    onClick={() => handleDelete(farm.id, farm.farm_name)}
                    disabled={deletingId === farm.id}
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="farm-card-body">
                {farm.location && (
                  <div className="farm-detail-item">
                    <MapPin size={16} className="detail-icon" />
                    <span>{farm.location}</span>
                  </div>
                )}
                {farm.area !== null && farm.area !== undefined && (
                  <div className="farm-detail-item">
                    <Layers size={16} className="detail-icon" />
                    <span>
                      {farm.area} {t('area_acres')}
                    </span>
                  </div>
                )}
                {farm.soil_type && (
                  <div className="farm-detail-badge">
                    <span>{t('soil_type')}: <strong>{farm.soil_type}</strong></span>
                  </div>
                )}
              </div>

              <div className="farm-card-footer">
                <button
                  className="card-text-link"
                  onClick={() => navigate(`/history?farm_id=${farm.id}`)}
                >
                  {t('soil_history')} →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyFarms;

