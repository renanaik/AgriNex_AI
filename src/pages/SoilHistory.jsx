import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  History,
  Plus,
  Filter,
  Trash2,
  Clock,
  Sparkles,
  TestTube,
  Image as ImageIcon,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

function SoilHistory() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFarmFilter = searchParams.get('farm_id') || '';

  const [farms, setFarms] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(initialFarmFilter);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // View mode: 'tests' | 'timeline'
  const [activeTab, setActiveTab] = useState('tests');
  const [farmHistoryData, setFarmHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load farms for filter dropdown
  useEffect(() => {
    api
      .get('/api/farms')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setFarms(res.data);
          if (!selectedFarm && res.data.length > 0) {
            // Keep default empty or selected
          }
        }
      })
      .catch((err) => console.error('Error fetching farms', err));
  }, []);

  const loadTests = useCallback(async (farmId) => {
    try {
      setLoading(true);
      const url = farmId ? `/api/soil-tests?farm_id=${farmId}` : '/api/soil-tests';
      const res = await api.get(url);
      setTests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch soil test history');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFarmHistory = useCallback(async (farmId) => {
    if (!farmId) {
      setFarmHistoryData(null);
      return;
    }
    try {
      setLoadingHistory(true);
      const res = await api.get(`/api/farms/${farmId}/history`);
      setFarmHistoryData(res.data);
    } catch (err) {
      console.error('Failed to fetch farm history timeline', err);
      setFarmHistoryData(null);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadTests(selectedFarm);
    if (selectedFarm) {
      loadFarmHistory(selectedFarm);
    } else {
      setFarmHistoryData(null);
    }
  }, [selectedFarm, loadTests, loadFarmHistory]);

  const handleFarmFilterChange = (e) => {
    const val = e.target.value;
    setSelectedFarm(val);
    if (val) {
      setSearchParams({ farm_id: val });
    } else {
      setSearchParams({});
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`${t('confirm_delete')}`)) return;

    try {
      setDeletingId(id);
      await api.delete(`/api/soil-tests/${id}`);
      toast.success(t('test_deleted'));
      setTests((prev) => prev.filter((t) => t.id !== id));
      if (selectedFarm) loadFarmHistory(selectedFarm);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete test');
    } finally {
      setDeletingId(null);
    }
  };

  const getFarmName = (farmId) => {
    if (!farmId) return t('no_farm_selected');
    const f = farms.find((farm) => farm.id === farmId);
    if (!f) return `Farm #${farmId}`;
    return f.farm_name + (f.field_name ? ` (${f.field_name})` : '');
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'healthy';
      case 'needs attention':
        return 'needs-attention';
      case 'poor':
        return 'poor';
      default:
        return '';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header-flex">
        <div className="page-title-group">
          <History size={26} className="title-icon" />
          <div>
            <h1>{t('soil_history')}</h1>
            <p className="subtitle">
              Inspect historical laboratory soil tests and persistent AI soil classification records per farm.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="secondary-btn" onClick={() => navigate('/upload')}>
            <ImageIcon size={16} /> {t('upload_image')}
          </button>
          <button className="primary-btn header-action-btn" onClick={() => navigate('/soil-test')}>
            <Plus size={18} /> {t('add_soil_test')}
          </button>
        </div>
      </div>

      {/* Tabs & Farm Filter Toolbar */}
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <label htmlFor="farm-filter">{t('select_farm')}:</label>
            <select
              id="farm-filter"
              value={selectedFarm}
              onChange={handleFarmFilterChange}
              className="filter-select"
            >
              <option value="">{t('all_farms') || 'All Farms'}</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farm_name} {farm.field_name ? `(${farm.field_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              style={{
                border: 'none',
                background: activeTab === 'tests' ? '#ffffff' : 'transparent',
                fontWeight: activeTab === 'tests' ? 600 : 400,
                color: activeTab === 'tests' ? '#0f172a' : '#64748b',
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: activeTab === 'tests' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TestTube size={14} /> Laboratory Tests ({tests.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              style={{
                border: 'none',
                background: activeTab === 'timeline' ? '#ffffff' : 'transparent',
                fontWeight: activeTab === 'timeline' ? 600 : 400,
                color: activeTab === 'timeline' ? '#0f172a' : '#64748b',
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: activeTab === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Clock size={14} /> Farm Analysis Timeline
            </button>
          </div>
        </div>

        <div className="record-count">
          Showing <strong>{tests.length}</strong> test{tests.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Tab 1: Structured Soil Test Table */}
      {activeTab === 'tests' && (
        <div className="table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>{t('loading')}</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="empty-state">
              <p>{t('no_tests')}</p>
              <button className="primary-btn inline-btn" onClick={() => navigate('/soil-test')}>
                + {t('add_soil_test')}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('field')}</th>
                  <th>{t('date')}</th>
                  <th>{t('soil_ph')}</th>
                  <th>{t('nitrogen')}</th>
                  <th>{t('phosphorus')}</th>
                  <th>{t('potassium')}</th>
                  <th>{t('organic_matter')}</th>
                  <th>{t('moisture')}</th>
                  <th>{t('status')}</th>
                  <th>Linked Photo</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((item) => (
                  <tr key={item.id}>
                    <td className="field-cell">
                      <strong>{getFarmName(item.farm_id)}</strong>
                      {item.notes && <span className="notes-tooltip">{item.notes}</span>}
                    </td>
                    <td>{new Date(item.tested_at).toLocaleDateString()}</td>
                    <td>
                      <strong>{item.ph}</strong>
                    </td>
                    <td>
                      {item.nitrogen} <span className="unit-label">mg/kg</span>
                    </td>
                    <td>
                      {item.phosphorus} <span className="unit-label">mg/kg</span>
                    </td>
                    <td>
                      {item.potassium} <span className="unit-label">mg/kg</span>
                    </td>
                    <td>{item.organic_matter !== null ? `${item.organic_matter}%` : '-'}</td>
                    <td>{item.moisture !== null ? `${item.moisture}%` : '-'}</td>
                    <td>
                      <span className={`status ${getStatusClass(item.status)}`}>
                        {t(item.status.toLowerCase().replace(' ', '_')) || item.status}
                      </span>
                    </td>
                    <td>
                      {item.soil_image_id ? (
                        <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>
                          Image #{item.soil_image_id}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="action-icon-btn delete-btn"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        title={t('delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Chronological Farm Analysis Timeline */}
      {activeTab === 'timeline' && (
        <div>
          {!selectedFarm ? (
            <div className="empty-state-card" style={{ padding: 36, textAlign: 'center', background: '#fff' }}>
              <MapPin size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
              <h3>Select a Farm to View Its Full Analysis Timeline</h3>
              <p style={{ color: '#64748b', maxWidth: 480, margin: '0 auto 16px' }}>
                Pick a farm from the dropdown above to inspect historical soil tests, AI visual classifications, and persistent image records for that specific field.
              </p>
            </div>
          ) : loadingHistory ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading historical farm records...</p>
            </div>
          ) : !farmHistoryData || farmHistoryData.timeline.length === 0 ? (
            <div className="empty-state-card" style={{ padding: 36, textAlign: 'center', background: '#fff' }}>
              <Clock size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
              <h3>No Historical Records for {farmHistoryData?.farm?.farm_name || 'This Farm'}</h3>
              <p style={{ color: '#64748b', marginBottom: 16 }}>
                Upload a soil photo or record a lab soil test to start tracking this field.
              </p>
              <button className="primary-btn inline-btn" onClick={() => navigate('/upload')}>
                <ImageIcon size={16} /> Upload Soil Photo
              </button>
            </div>
          ) : (
            <div>
              {/* Farm Summary Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  borderRadius: 12,
                  padding: '18px 24px',
                  marginBottom: 24,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>
                    {farmHistoryData.farm.farm_name} {farmHistoryData.farm.field_name && `(${farmHistoryData.farm.field_name})`}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
                    Location: {farmHistoryData.farm.location || 'N/A'} • Area: {farmHistoryData.farm.area ? `${farmHistoryData.farm.area} Acres` : 'N/A'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{farmHistoryData.total_tests}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Soil Tests</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{farmHistoryData.total_images}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Soil Images</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{farmHistoryData.total_analyses}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>AI Analyses</div>
                  </div>
                </div>
              </div>

              {/* Timeline List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {farmHistoryData.timeline.map((item) => {
                  const isTest = item.type === 'soil_test';
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 16,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: isTest ? '#eff6ff' : '#f5f3ff',
                          color: isTest ? '#2563eb' : '#7c3aed',
                        }}
                      >
                        {isTest ? <TestTube size={20} /> : <Sparkles size={20} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>{item.title}</h4>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#475569' }}>{item.summary}</p>

                        {!isTest && item.details?.probabilities && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {Object.entries(item.details.probabilities).map(([cName, pVal]) => (
                              <span
                                key={cName}
                                style={{
                                  fontSize: 11,
                                  background: cName === item.details.predicted_soil_type ? '#ede9fe' : '#f8fafc',
                                  color: cName === item.details.predicted_soil_type ? '#6d28d9' : '#64748b',
                                  fontWeight: cName === item.details.predicted_soil_type ? 600 : 400,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                {cName.replace('_', ' ')}: {pVal}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SoilHistory;
