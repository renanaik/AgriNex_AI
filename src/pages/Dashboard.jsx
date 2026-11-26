import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { recommendations } from '../data/dummyData';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_tests: 0,
    healthy_count: 0,
    attention_count: 0,
    poor_count: 0,
  });
  const [recentTests, setRecentTests] = useState([]);
  const [farmsMap, setFarmsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [statsRes, testsRes, farmsRes] = await Promise.allSettled([
          api.get('/api/soil-tests/stats'),
          api.get('/api/soil-tests'),
          api.get('/api/farms'),
        ]);

        if (!isMounted) return;

        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data);
        }

        const farmLookup = {};
        if (farmsRes.status === 'fulfilled' && Array.isArray(farmsRes.value.data)) {
          farmsRes.value.data.forEach((f) => {
            farmLookup[f.id] = f.farm_name + (f.field_name ? ` - ${f.field_name}` : '');
          });
          setFarmsMap(farmLookup);
        }

        if (testsRes.status === 'fulfilled' && Array.isArray(testsRes.value.data)) {
          // Sort newest first, take top 5
          const sorted = [...testsRes.value.data].sort(
            (a, b) => new Date(b.tested_at) - new Date(a.tested_at)
          );
          setRecentTests(sorted.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const statItems = [
    {
      id: 1,
      title: t('total_soil_tests'),
      value: loading ? '...' : stats.total_tests.toString(),
      description: t('across_all_fields'),
    },
    {
      id: 2,
      title: t('healthy_soil'),
      value: loading ? '...' : stats.healthy_count.toString(),
      description: stats.total_tests > 0
        ? `${Math.round((stats.healthy_count / stats.total_tests) * 100)}% ${t('of_total_samples')}`
        : `0% ${t('of_total_samples')}`,
    },
    {
      id: 3,
      title: t('needs_attention'),
      value: loading ? '...' : stats.attention_count.toString(),
      description: t('require_improvement'),
    },
    {
      id: 4,
      title: t('poor_soil'),
      value: loading ? '...' : stats.poor_count.toString(),
      description: t('critical_conditions'),
    },
  ];

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
    <div className="dashboard-content">
      <div className="welcome-section">
        <div>
          <h1>{t('dashboard')}</h1>
          <p>
            {t('welcome_back')}, {user?.full_name || 'Farmer'}! {t('monitor_soil')}
          </p>
        </div>

        <div className="welcome-actions">
          <button className="upload-btn" onClick={() => navigate('/soil-test')}>
            + {t('add_soil_test')}
          </button>
          <button className="secondary-btn" onClick={() => navigate('/upload')}>
            {t('upload_image')}
          </button>
        </div>
      </div>

      <section className="stats-grid">
        {statItems.map((stat) => (
          <StatCard
            key={stat.id}
            title={stat.title}
            value={stat.value}
            description={stat.description}
          />
        ))}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>{t('recent_analysis')}</h2>
          <Link to="/history">{t('view_all')}</Link>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>{t('loading')}</p>
            </div>
          ) : recentTests.length === 0 ? (
            <div className="empty-state">
              <p>{t('no_tests')}</p>
              <button
                className="primary-btn inline-btn"
                onClick={() => navigate('/soil-test')}
              >
                + {t('add_soil_test')}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('field')}</th>
                  <th>{t('date')}</th>
                  <th>{t('ph_level')}</th>
                  <th>{t('nitrogen')} (mg/kg)</th>
                  <th>{t('phosphorus')} (mg/kg)</th>
                  <th>{t('potassium')} (mg/kg)</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.map((item) => (
                  <tr key={item.id}>
                    <td>{farmsMap[item.farm_id] || item.farm_id ? `Farm #${item.farm_id}` : t('no_farm_selected')}</td>
                    <td>{new Date(item.tested_at).toLocaleDateString()}</td>
                    <td>{item.ph}</td>
                    <td>{item.nitrogen}</td>
                    <td>{item.phosphorus}</td>
                    <td>{item.potassium}</td>
                    <td>
                      <span className={`status ${getStatusClass(item.status)}`}>
                        {t(item.status.toLowerCase().replace(' ', '_')) || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="content-section">
        <h2>{t('recommendations')}</h2>
        <div className="recommendation-grid">
          {recommendations.map((item) => (
            <div className="recommendation-card" key={item.id}>
              <span className={`priority ${item.priority.toLowerCase()}`}>
                {item.priority} Priority
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

