import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  TreePine,
  CheckCircle2,
  AlertTriangle,
  Award,
  Calendar,
  Layers,
  Activity,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function Reports() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [farms, setFarms] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      try {
        const [farmsRes, testsRes] = await Promise.allSettled([
          api.get('/api/farms'),
          api.get('/api/soil-tests'),
        ]);

        if (farmsRes.status === 'fulfilled' && Array.isArray(farmsRes.value.data)) {
          setFarms(farmsRes.value.data);
        }
        if (testsRes.status === 'fulfilled' && Array.isArray(testsRes.value.data)) {
          setTests(testsRes.value.data);
        }
      } catch (err) {
        console.error('Failed to load report data', err);
      } finally {
        setLoading(false);
      }
    }

    loadReportData();
  }, []);

  const filteredTests = useMemo(() => {
    if (selectedFarmId === 'all') return tests;
    const farmIdNum = parseInt(selectedFarmId, 10);
    return tests.filter((t) => t.farm_id === farmIdNum);
  }, [tests, selectedFarmId]);

  const selectedFarmObj = useMemo(() => {
    if (selectedFarmId === 'all') return null;
    return farms.find((f) => f.id === parseInt(selectedFarmId, 10));
  }, [farms, selectedFarmId]);

  // Aggregate stats
  const metrics = useMemo(() => {
    if (filteredTests.length === 0) {
      return {
        avgPh: 0,
        avgN: 0,
        avgP: 0,
        avgK: 0,
        avgOm: 0,
        avgMoisture: 0,
        healthScore: 0,
        grade: 'N/A',
        healthyPercent: 0,
      };
    }

    const count = filteredTests.length;
    const sumPh = filteredTests.reduce((acc, cur) => acc + cur.ph, 0);
    const sumN = filteredTests.reduce((acc, cur) => acc + cur.nitrogen, 0);
    const sumP = filteredTests.reduce((acc, cur) => acc + cur.phosphorus, 0);
    const sumK = filteredTests.reduce((acc, cur) => acc + cur.potassium, 0);
    const sumOm = filteredTests.reduce((acc, cur) => acc + (cur.organic_matter || 0), 0);
    const sumMoist = filteredTests.reduce((acc, cur) => acc + (cur.moisture || 0), 0);

    const healthyCount = filteredTests.filter((t) => t.status === 'Healthy').length;

    const avgPh = Number((sumPh / count).toFixed(2));
    const avgN = Number((sumN / count).toFixed(1));
    const avgP = Number((sumP / count).toFixed(1));
    const avgK = Number((sumK / count).toFixed(1));
    const avgOm = Number((sumOm / count).toFixed(1));
    const avgMoisture = Number((sumMoist / count).toFixed(1));

    // Calculate Soil Health Index (0 - 100)
    let score = 50;

    // pH scoring (ideal 6.5 - 7.5)
    if (avgPh >= 6.5 && avgPh <= 7.5) score += 20;
    else if (avgPh >= 6.0 && avgPh <= 8.0) score += 12;
    else score -= 10;

    // Nitrogen scoring (ideal 120 - 250)
    if (avgN >= 120 && avgN <= 250) score += 12;
    else if (avgN >= 80) score += 6;
    else score -= 8;

    // Phosphorus scoring (ideal 35 - 80)
    if (avgP >= 35 && avgP <= 80) score += 10;
    else if (avgP >= 20) score += 5;
    else score -= 5;

    // Potassium scoring (ideal 150 - 300)
    if (avgK >= 150 && avgK <= 300) score += 8;
    else if (avgK >= 100) score += 4;
    else score -= 4;

    const healthScore = Math.max(20, Math.min(96, Math.round(score)));
    let grade = 'B';
    if (healthScore >= 80) grade = 'A (Excellent)';
    else if (healthScore >= 65) grade = 'B (Good / Moderate)';
    else if (healthScore >= 50) grade = 'C (Needs Attention)';
    else grade = 'D (Critical)';

    return {
      avgPh,
      avgN,
      avgP,
      avgK,
      avgOm,
      avgMoisture,
      healthScore,
      grade,
      healthyPercent: Math.round((healthyCount / count) * 100),
    };
  }, [filteredTests]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container report-page-printable">
      <div className="page-header-flex no-print">
        <div className="page-title-group">
          <FileText size={26} className="title-icon" />
          <div>
            <h1>{t('reports')}</h1>
            <p className="subtitle">
              {language === 'gu'
                ? 'જમીન વિશ્લેષણ અહેવાલ, આરોગ્ય ઇન્ડેક્સ અને પ્રમાણપત્ર'
                : 'Comprehensive Soil Health Certificate, Nutrient Audits & Official Recommendations'}
            </p>
          </div>
        </div>

        <div className="report-action-buttons">
          <button className="primary-btn header-action-btn" onClick={handlePrint}>
            <Printer size={16} /> Print / Save PDF Report
          </button>
        </div>
      </div>

      {/* Filter Toolbar (hidden in print) */}
      <div className="filter-bar no-print">
        <div className="filter-group">
          <TreePine size={16} className="filter-icon" />
          <label htmlFor="report-farm-select">Filter by Farm:</label>
          <select
            id="report-farm-select"
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Farms & Fields (બધા ખેતર)</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.farm_name} {f.field_name ? `(${f.field_name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="record-count">
          Analyzing <strong>{filteredTests.length}</strong> soil test record{filteredTests.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Official Certificate & Report Container */}
      <div className="soil-report-sheet">
        {/* Report Official Header */}
        <div className="report-doc-header">
          <div className="report-doc-brand">
            <div className="doc-logo-circle">
              <Award size={28} />
            </div>
            <div>
              <h2>AgriNex Soil Health & Nutrient Analysis Report</h2>
              <p className="doc-tagline">National Soil Health & Precision Agriculture Monitoring</p>
            </div>
          </div>

          <div className="report-meta-grid">
            <div>
              <strong>Farmer Name:</strong> {user?.full_name || 'Farmer'}
            </div>
            <div>
              <strong>Report Date:</strong> {new Date().toLocaleDateString()}
            </div>
            <div>
              <strong>Field Target:</strong> {selectedFarmObj ? selectedFarmObj.farm_name : 'All Registered Farms'}
            </div>
            <div>
              <strong>Soil Type:</strong> {selectedFarmObj?.soil_type || 'Mixed / Loamy'}
            </div>
          </div>
        </div>

        {/* Score & Health Summary */}
        <div className="report-score-banner">
          <div className="score-block">
            <span className="score-super">Soil Health Index</span>
            <div className="score-main-val">
              <span className="big-num">{metrics.healthScore}</span>
              <span className="max-num">/ 100</span>
            </div>
            <span className="score-grade-tag">Rating: {metrics.grade}</span>
          </div>

          <div className="score-details-list">
            <div className="score-stat-cell">
              <span className="cell-label">Average pH</span>
              <span className={`cell-val ${metrics.avgPh >= 6.5 && metrics.avgPh <= 7.5 ? 'text-healthy' : 'text-warn'}`}>
                {metrics.avgPh || '-'}
              </span>
              <span className="cell-hint">Ideal: 6.5 - 7.5</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Avg Nitrogen (N)</span>
              <span className="cell-val">{metrics.avgN} mg/kg</span>
              <span className="cell-hint">Target: 140+</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Avg Phosphorus (P)</span>
              <span className="cell-val">{metrics.avgP} mg/kg</span>
              <span className="cell-hint">Target: 35+</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Avg Potassium (K)</span>
              <span className="cell-val">{metrics.avgK} mg/kg</span>
              <span className="cell-hint">Target: 150+</span>
            </div>
          </div>
        </div>

        {/* Detailed Parameter Audit Table */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <Activity size={18} /> Soil Nutrient Audit & Quality Benchmark
          </h3>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nutrient / Parameter</th>
                  <th>Observed Average</th>
                  <th>Optimal Benchmark</th>
                  <th>Status Assessment</th>
                  <th>Correction Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Soil Reaction (pH)</strong>
                  </td>
                  <td>{metrics.avgPh}</td>
                  <td>6.5 - 7.5 (Neutral)</td>
                  <td>
                    <span className={`status ${metrics.avgPh >= 6.5 && metrics.avgPh <= 7.5 ? 'healthy' : metrics.avgPh < 6.0 || metrics.avgPh > 8.0 ? 'poor' : 'needs-attention'}`}>
                      {metrics.avgPh >= 6.5 && metrics.avgPh <= 7.5 ? 'Optimal' : metrics.avgPh < 6.5 ? 'Acidic' : 'Alkaline'}
                    </span>
                  </td>
                  <td>
                    {metrics.avgPh < 6.5 ? 'Apply Agricultural Lime (CaCO3)' : metrics.avgPh > 7.5 ? 'Apply Gypsum & Organic Compost' : 'No correction required'}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Available Nitrogen (N)</strong>
                  </td>
                  <td>{metrics.avgN} mg/kg</td>
                  <td>140 - 280 mg/kg</td>
                  <td>
                    <span className={`status ${metrics.avgN >= 140 ? 'healthy' : metrics.avgN < 80 ? 'poor' : 'needs-attention'}`}>
                      {metrics.avgN >= 140 ? 'Adequate' : metrics.avgN < 80 ? 'Deficient' : 'Low'}
                    </span>
                  </td>
                  <td>
                    {metrics.avgN < 140 ? 'Apply Neem-Coated Urea in split doses & green manuring' : 'Maintain balanced dosing'}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Available Phosphorus (P)</strong>
                  </td>
                  <td>{metrics.avgP} mg/kg</td>
                  <td>35 - 70 mg/kg</td>
                  <td>
                    <span className={`status ${metrics.avgP >= 35 ? 'healthy' : metrics.avgP < 20 ? 'poor' : 'needs-attention'}`}>
                      {metrics.avgP >= 35 ? 'Adequate' : metrics.avgP < 20 ? 'Deficient' : 'Moderate'}
                    </span>
                  </td>
                  <td>
                    {metrics.avgP < 35 ? 'Apply Single Super Phosphate (SSP) or DAP + PSB culture' : 'Maintain crop rotation'}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Available Potassium (K)</strong>
                  </td>
                  <td>{metrics.avgK} mg/kg</td>
                  <td>150 - 300 mg/kg</td>
                  <td>
                    <span className={`status ${metrics.avgK >= 150 ? 'healthy' : metrics.avgK < 100 ? 'poor' : 'needs-attention'}`}>
                      {metrics.avgK >= 150 ? 'Adequate' : metrics.avgK < 100 ? 'Deficient' : 'Low'}
                    </span>
                  </td>
                  <td>
                    {metrics.avgK < 150 ? 'Apply Muriate of Potash (MOP) to boost crop drought resistance' : 'Satisfactory levels'}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Organic Matter</strong>
                  </td>
                  <td>{metrics.avgOm}%</td>
                  <td>&gt; 2.5%</td>
                  <td>
                    <span className={`status ${metrics.avgOm >= 2.5 ? 'healthy' : 'needs-attention'}`}>
                      {metrics.avgOm >= 2.5 ? 'Rich' : 'Moderate'}
                    </span>
                  </td>
                  <td>
                    {metrics.avgOm < 2.5 ? 'Incorporate 4-5 tonnes Farm Yard Manure (FYM) or crop residue' : 'Continue organic mulching'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Historical Log of Field Tests */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <Calendar size={18} /> Soil Test Log Included in this Report
          </h3>

          {filteredTests.length === 0 ? (
            <p className="text-muted">No soil test records found for the selected filter.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Field / Farm</th>
                    <th>pH</th>
                    <th>N (mg/kg)</th>
                    <th>P (mg/kg)</th>
                    <th>K (mg/kg)</th>
                    <th>Status</th>
                    <th className="no-print">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.map((t) => (
                    <tr
                      key={t.id}
                      className="clickable-report-row"
                      onClick={() => navigate(`/reports/${t.id}`)}
                      title="Click to view detailed soil report"
                    >
                      <td>{new Date(t.tested_at).toLocaleDateString()}</td>
                      <td>{farms.find((f) => f.id === t.farm_id)?.farm_name || `Farm #${t.farm_id || '-'}`}</td>
                      <td>{t.ph}</td>
                      <td>{t.nitrogen}</td>
                      <td>{t.phosphorus}</td>
                      <td>{t.potassium}</td>
                      <td>
                        <span className={`status ${t.status?.toLowerCase().replace(' ', '-')}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="no-print">
                        <button
                          className="view-report-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports/${t.id}`);
                          }}
                          title="View Full Report"
                        >
                          <Eye size={15} /> Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Official Certification Signature Block */}
        <div className="report-signature-block">
          <div>
            <p className="sig-title">System Verified By:</p>
            <p className="sig-name">AgriNex Digital Soil Testing Platform</p>
            <span className="sig-id">Doc ID: AGX-{Date.now().toString().slice(-8)}</span>
          </div>

          <div className="sig-box">
            <div className="sig-line"></div>
            <p className="sig-title">Certified Soil Analyst Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
