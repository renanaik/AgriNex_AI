import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Award,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sprout,
  TreePine,
  Calendar,
  Layers,
  TrendingUp,
  Printer,
  Leaf,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// ── Benchmarks & assessment logic (reused from Reports page aggregate logic) ──

const BENCHMARKS = {
  nitrogen:       { label: 'Nitrogen (N)',                unit: 'mg/kg', optimalLow: 140,  optimalHigh: 280,  benchmarkText: '140 – 280 mg/kg' },
  phosphorus:     { label: 'Phosphorus (P)',              unit: 'mg/kg', optimalLow: 35,   optimalHigh: 70,   benchmarkText: '35 – 70 mg/kg' },
  potassium:      { label: 'Potassium (K)',               unit: 'mg/kg', optimalLow: 150,  optimalHigh: 300,  benchmarkText: '150 – 300 mg/kg' },
  ph:             { label: 'Soil pH',                     unit: '',      optimalLow: 6.5,  optimalHigh: 7.5,  benchmarkText: '6.5 – 7.5 (Neutral)' },
  organic_matter: { label: 'Organic Matter',              unit: '%',     optimalLow: 2.5,  optimalHigh: 100,  benchmarkText: '> 2.5%' },
  moisture:       { label: 'Moisture',                    unit: '%',     optimalLow: 20,   optimalHigh: 60,   benchmarkText: '20 – 60%' },
};

function assessParameter(key, value) {
  if (value === null || value === undefined) {
    return { status: 'N/A', cssClass: '', correction: 'No data recorded for this parameter.' };
  }

  const b = BENCHMARKS[key];
  if (!b) return { status: 'N/A', cssClass: '', correction: '—' };

  // pH has special logic (acidic vs alkaline)
  if (key === 'ph') {
    if (value >= b.optimalLow && value <= b.optimalHigh) {
      return { status: 'Optimal', cssClass: 'healthy', correction: 'No correction required. Soil pH is within the ideal neutral range.' };
    }
    if (value < b.optimalLow) {
      const severity = value < 5.5 ? 'Low (Strongly Acidic)' : 'Slightly Acidic';
      return {
        status: severity,
        cssClass: value < 5.5 ? 'poor' : 'needs-attention',
        correction: 'Apply Agricultural Lime (CaCO3) at 200–400 kg/acre, 3–4 weeks before sowing. Incorporate well-rotted Farm Yard Manure (FYM) to buffer acidity.',
      };
    }
    const severity = value > 8.5 ? 'High (Strongly Alkaline)' : 'Slightly Alkaline';
    return {
      status: severity,
      cssClass: value > 8.5 ? 'poor' : 'needs-attention',
      correction: 'Apply 250 kg Agricultural Gypsum + 2–3 tonnes organic compost per acre to displace sodium and lower pH.',
    };
  }

  // Nitrogen
  if (key === 'nitrogen') {
    if (value >= b.optimalLow && value <= b.optimalHigh) {
      return { status: 'Adequate', cssClass: 'healthy', correction: 'Maintain balanced nitrogen dosing with existing fertilizer schedule.' };
    }
    if (value < b.optimalLow) {
      const severity = value < 80 ? 'Deficient' : 'Low';
      return {
        status: severity,
        cssClass: value < 80 ? 'poor' : 'needs-attention',
        correction: 'Apply 45–55 kg Neem-Coated Urea per acre in 2–3 split doses. Integrate green manuring (Dhaincha / Sunhemp) for sustained nitrogen release.',
      };
    }
    return { status: 'High', cssClass: 'needs-attention', correction: 'Reduce synthetic urea by 30–40%. Excess nitrogen promotes vegetative growth over grain production and attracts pests.' };
  }

  // Phosphorus
  if (key === 'phosphorus') {
    if (value >= b.optimalLow && value <= b.optimalHigh) {
      return { status: 'Adequate', cssClass: 'healthy', correction: 'Maintain crop rotation with legumes. No additional phosphorus needed.' };
    }
    if (value < b.optimalLow) {
      const severity = value < 20 ? 'Deficient' : 'Moderate';
      return {
        status: severity,
        cssClass: value < 20 ? 'poor' : 'needs-attention',
        correction: 'Apply 50 kg DAP or 100 kg Single Super Phosphate (SSP) per acre at basal stage. Use PSB (Phosphate Solubilizing Bacteria) culture with FYM.',
      };
    }
    return { status: 'High', cssClass: 'needs-attention', correction: 'Reduce phosphatic fertilizer application. High P may inhibit zinc and iron uptake.' };
  }

  // Potassium
  if (key === 'potassium') {
    if (value >= b.optimalLow && value <= b.optimalHigh) {
      return { status: 'Adequate', cssClass: 'healthy', correction: 'Satisfactory potassium levels. Continue current management.' };
    }
    if (value < b.optimalLow) {
      const severity = value < 100 ? 'Deficient' : 'Low';
      return {
        status: severity,
        cssClass: value < 100 ? 'poor' : 'needs-attention',
        correction: 'Apply 25–35 kg Muriate of Potash (MOP) per acre to boost crop drought resistance and stem strength.',
      };
    }
    return { status: 'High', cssClass: 'needs-attention', correction: 'Reduce potash application. Excessive potassium may interfere with magnesium and calcium absorption.' };
  }

  // Organic Matter
  if (key === 'organic_matter') {
    if (value >= b.optimalLow) {
      return { status: 'Rich', cssClass: 'healthy', correction: 'Continue organic mulching and crop residue recycling to sustain organic carbon.' };
    }
    return {
      status: value < 1.5 ? 'Deficient' : 'Moderate',
      cssClass: value < 1.5 ? 'poor' : 'needs-attention',
      correction: 'Incorporate 4–5 tonnes well-rotted FYM or 1.5 tonnes vermicompost per acre. Consider cover cropping to build organic matter.',
    };
  }

  // Moisture
  if (key === 'moisture') {
    if (value >= b.optimalLow && value <= b.optimalHigh) {
      return { status: 'Optimal', cssClass: 'healthy', correction: 'Moisture is within the suitable range. Continue current irrigation schedule.' };
    }
    if (value < b.optimalLow) {
      return {
        status: value < 10 ? 'Critically Dry' : 'Low',
        cssClass: value < 10 ? 'poor' : 'needs-attention',
        correction: 'Increase irrigation frequency. Apply organic mulch (4–6 cm layer) to reduce evaporation and retain soil moisture.',
      };
    }
    return {
      status: 'Waterlogged',
      cssClass: 'needs-attention',
      correction: 'Improve drainage. Excess moisture may cause root rot and fungal diseases. Consider raised-bed planting.',
    };
  }

  return { status: 'N/A', cssClass: '', correction: '—' };
}

// ── Health score calculation (same logic as Reports.jsx) ──

function computeHealthScore(test) {
  let score = 50;

  // pH (ideal 6.5–7.5)
  if (test.ph >= 6.5 && test.ph <= 7.5) score += 20;
  else if (test.ph >= 6.0 && test.ph <= 8.0) score += 12;
  else score -= 10;

  // Nitrogen (ideal 120–250)
  if (test.nitrogen >= 120 && test.nitrogen <= 250) score += 12;
  else if (test.nitrogen >= 80) score += 6;
  else score -= 8;

  // Phosphorus (ideal 35–80)
  if (test.phosphorus >= 35 && test.phosphorus <= 80) score += 10;
  else if (test.phosphorus >= 20) score += 5;
  else score -= 5;

  // Potassium (ideal 150–300)
  if (test.potassium >= 150 && test.potassium <= 300) score += 8;
  else if (test.potassium >= 100) score += 4;
  else score -= 4;

  const healthScore = Math.max(20, Math.min(96, Math.round(score)));
  let grade;
  if (healthScore >= 80) grade = 'A (Excellent)';
  else if (healthScore >= 65) grade = 'B (Good / Moderate)';
  else if (healthScore >= 50) grade = 'C (Needs Attention)';
  else grade = 'D (Critical)';

  return { healthScore, grade };
}

// ── Crop suitability (reuse CROP_DATABASE from CropAdvisory logic) ──

const CROP_DATABASE = [
  { id: 'wheat', nameEn: 'Wheat', idealPh: [6.0, 7.5], minN: 80, minP: 30, minK: 120, preferredSoil: ['Loamy', 'Clay', 'Silt'] },
  { id: 'cotton', nameEn: 'Cotton', idealPh: [6.0, 8.0], minN: 100, minP: 40, minK: 150, preferredSoil: ['Clay', 'Loamy'] },
  { id: 'groundnut', nameEn: 'Groundnut', idealPh: [6.0, 7.5], minN: 40, minP: 40, minK: 100, preferredSoil: ['Sandy', 'Loamy'] },
  { id: 'chickpea', nameEn: 'Chickpea / Gram', idealPh: [6.0, 8.0], minN: 30, minP: 35, minK: 80, preferredSoil: ['Loamy', 'Clay', 'Sandy'] },
  { id: 'mustard', nameEn: 'Mustard', idealPh: [6.2, 7.8], minN: 70, minP: 30, minK: 90, preferredSoil: ['Sandy', 'Loamy'] },
  { id: 'maize', nameEn: 'Maize', idealPh: [5.8, 7.5], minN: 110, minP: 45, minK: 130, preferredSoil: ['Loamy', 'Silt'] },
  { id: 'pearl_millet', nameEn: 'Bajra / Pearl Millet', idealPh: [6.5, 8.5], minN: 50, minP: 25, minK: 70, preferredSoil: ['Sandy', 'Loamy'] },
  { id: 'paddy', nameEn: 'Paddy / Rice', idealPh: [5.5, 7.2], minN: 100, minP: 40, minK: 120, preferredSoil: ['Clay', 'Silt'] },
];

function getTopCrops(test, soilType) {
  return CROP_DATABASE.map((crop) => {
    let score = 100;
    if (test.ph < crop.idealPh[0]) score -= (crop.idealPh[0] - test.ph) * 20;
    else if (test.ph > crop.idealPh[1]) score -= (test.ph - crop.idealPh[1]) * 18;
    if (test.nitrogen < crop.minN) score -= Math.min(25, ((crop.minN - test.nitrogen) / crop.minN) * 25);
    if (test.phosphorus < crop.minP) score -= Math.min(20, ((crop.minP - test.phosphorus) / crop.minP) * 20);
    if (test.potassium < crop.minK) score -= Math.min(10, ((crop.minK - test.potassium) / crop.minK) * 10);
    if (soilType && crop.preferredSoil.includes(soilType)) score += 5;
    return { ...crop, score: Math.max(15, Math.min(98, Math.round(score))) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function SoilReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [test, setTest] = useState(null);
  const [farm, setFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);

        // Fetch the soil test by ID (backend enforces ownership)
        const testRes = await api.get(`/api/soil-tests/${id}`);
        const testData = testRes.data;

        if (!mounted) return;
        setTest(testData);

        // If the test is linked to a farm, fetch farm details
        if (testData.farm_id) {
          try {
            const farmRes = await api.get(`/api/farms/${testData.farm_id}`);
            if (mounted) setFarm(farmRes.data);
          } catch (farmErr) {
            // Farm may have been deleted; non-critical
            console.warn('Could not load farm details', farmErr);
          }
        }
      } catch (err) {
        if (!mounted) return;
        if (err.response?.status === 404) {
          setError('Soil test report not found or access denied.');
        } else if (err.response?.status === 401) {
          setError('Authentication required. Please log in again.');
        } else {
          setError(err.response?.data?.detail || 'Failed to load report details.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReport();
    return () => { mounted = false; };
  }, [id]);

  // ── Computed data ──

  const { healthScore, grade } = useMemo(() => {
    if (!test) return { healthScore: 0, grade: 'N/A' };
    return computeHealthScore(test);
  }, [test]);

  const parameterRows = useMemo(() => {
    if (!test) return [];

    const keys = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'organic_matter', 'moisture'];
    return keys.map((key) => {
      const val = test[key];
      const b = BENCHMARKS[key];
      const assessment = assessParameter(key, val);
      return {
        key,
        label: b?.label || key,
        observed: val !== null && val !== undefined ? `${val}${b?.unit ? ' ' + b.unit : ''}` : '—',
        benchmark: b?.benchmarkText || '—',
        ...assessment,
      };
    });
  }, [test]);

  const deficiencies = useMemo(() => {
    return parameterRows.filter((r) => r.cssClass === 'poor' || r.cssClass === 'needs-attention');
  }, [parameterRows]);

  const topCrops = useMemo(() => {
    if (!test) return [];
    return getTopCrops(test, farm?.soil_type || null);
  }, [test, farm]);

  // ── Overall Summary Text ──

  const overallSummary = useMemo(() => {
    if (!test) return '';

    const parts = [];

    if (healthScore >= 80) {
      parts.push('The soil is in excellent overall health with well-balanced nutrient levels. Continue current fertilization and organic matter management practices.');
    } else if (healthScore >= 65) {
      parts.push('The soil is in good condition overall, though minor nutrient adjustments may improve crop performance.');
    } else if (healthScore >= 50) {
      parts.push('The soil requires attention in several key nutrient areas. Targeted fertilizer applications and soil amendments are recommended before the next cropping cycle.');
    } else {
      parts.push('The soil is in critical condition with significant nutrient imbalances. Immediate corrective action is required to avoid crop failure and long-term soil degradation.');
    }

    if (deficiencies.length > 0) {
      const labels = deficiencies.map((d) => d.label);
      parts.push(`Parameters requiring improvement: ${labels.join(', ')}.`);
    } else {
      parts.push('All measured parameters are within the optimal benchmark range.');
    }

    return parts.join(' ');
  }, [test, healthScore, deficiencies]);

  // ── Render ──

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state" style={{ padding: '80px 0', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state-card" style={{ maxWidth: 500, margin: '60px auto' }}>
          <AlertTriangle size={40} className="empty-state-icon" style={{ color: 'var(--danger)' }} />
          <h3>Report Unavailable</h3>
          <p>{error}</p>
          <button className="primary-btn inline-btn" onClick={() => navigate('/reports')} style={{ marginTop: 16 }}>
            <ArrowLeft size={16} /> Back to Reports
          </button>
        </div>
      </div>
    );
  }

  if (!test) return null;

  const scoreColorClass = healthScore >= 80 ? 'text-healthy' : healthScore >= 50 ? 'text-warn' : 'text-danger';

  return (
    <div className="page-container report-page-printable">
      {/* Back Button & Header */}
      <div className="page-header-flex no-print">
        <div className="page-title-group">
          <button
            className="back-nav-btn"
            onClick={() => navigate('/reports')}
            title="Back to Reports"
          >
            <ArrowLeft size={20} />
          </button>
          <FileText size={26} className="title-icon" />
          <div>
            <h1>Detailed Soil Report</h1>
            <p className="subtitle">
              Test #{test.id} — {new Date(test.tested_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="report-action-buttons">
          <button className="primary-btn header-action-btn" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ═══ Report Sheet ═══ */}
      <div className="soil-report-sheet">

        {/* Official Header */}
        <div className="report-doc-header">
          <div className="report-doc-brand">
            <div className="doc-logo-circle">
              <Award size={28} />
            </div>
            <div>
              <h2>AgriNex Individual Soil Test Report</h2>
              <p className="doc-tagline">Detailed Nutrient Analysis & Corrective Action Plan</p>
            </div>
          </div>

          <div className="report-meta-grid">
            <div>
              <strong>Farmer Name:</strong> {user?.full_name || 'Farmer'}
            </div>
            <div>
              <strong>Test Date:</strong> {new Date(test.tested_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div>
              <strong>Farm:</strong> {farm ? farm.farm_name : (test.farm_id ? `Farm #${test.farm_id}` : 'Not linked to any farm')}
            </div>
            <div>
              <strong>Field:</strong> {farm?.field_name || '—'}
            </div>
            <div>
              <strong>Soil Type:</strong> {farm?.soil_type || 'Not specified'}
            </div>
            <div>
              <strong>Health Status:</strong>{' '}
              <span className={`status ${test.status?.toLowerCase().replace(' ', '-')}`}>
                {test.status}
              </span>
            </div>
          </div>
        </div>

        {/* Score & Health Banner */}
        <div className="report-score-banner">
          <div className="score-block">
            <span className="score-super">Soil Health Index</span>
            <div className="score-main-val">
              <span className={`big-num ${scoreColorClass}`}>{healthScore}</span>
              <span className="max-num">/ 100</span>
            </div>
            <span className="score-grade-tag">Rating: {grade}</span>
          </div>

          <div className="score-details-list">
            <div className="score-stat-cell">
              <span className="cell-label">Soil pH</span>
              <span className={`cell-val ${test.ph >= 6.5 && test.ph <= 7.5 ? 'text-healthy' : 'text-warn'}`}>
                {test.ph}
              </span>
              <span className="cell-hint">Ideal: 6.5 – 7.5</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Nitrogen (N)</span>
              <span className="cell-val">{test.nitrogen} mg/kg</span>
              <span className="cell-hint">Target: 140+</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Phosphorus (P)</span>
              <span className="cell-val">{test.phosphorus} mg/kg</span>
              <span className="cell-hint">Target: 35+</span>
            </div>
            <div className="score-stat-cell">
              <span className="cell-label">Potassium (K)</span>
              <span className="cell-val">{test.potassium} mg/kg</span>
              <span className="cell-hint">Target: 150+</span>
            </div>
          </div>
        </div>

        {/* Overall Summary */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <Leaf size={18} /> Overall Soil Health Summary
          </h3>
          <div className="report-summary-text">
            <p>{overallSummary}</p>
            {test.notes && (
              <div className="report-notes-block">
                <strong>Farmer's Notes:</strong> {test.notes}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Detailed Nutrient Analysis Table ═══ */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <Activity size={18} /> Detailed Nutrient Analysis
          </h3>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>NUTRIENT / PARAMETER</th>
                  <th>OBSERVED AVERAGE</th>
                  <th>OPTIMAL BENCHMARK</th>
                  <th>STATUS ASSESSMENT</th>
                  <th>CORRECTION ACTION</th>
                </tr>
              </thead>
              <tbody>
                {parameterRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    <td>{row.observed}</td>
                    <td>{row.benchmark}</td>
                    <td>
                      <span className={`status ${row.cssClass}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="correction-cell">{row.correction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Deficiencies & Key Findings ═══ */}
        {deficiencies.length > 0 && (
          <div className="report-section-box">
            <h3 className="report-box-title">
              <AlertTriangle size={18} /> Nutrient Deficiencies & Key Findings
            </h3>
            <div className="deficiency-cards-row">
              {deficiencies.map((d) => (
                <div key={d.key} className={`deficiency-card ${d.cssClass}`}>
                  <div className="deficiency-card-header">
                    {d.cssClass === 'poor' ? <XCircle size={18} /> : <AlertTriangle size={18} />}
                    <span className="deficiency-param-name">{d.label}</span>
                    <span className={`status ${d.cssClass}`}>{d.status}</span>
                  </div>
                  <p className="deficiency-correction">{d.correction}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Crop Suitability ═══ */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <Sprout size={18} /> Crop Suitability Based on This Test
          </h3>
          <div className="report-crop-grid">
            {topCrops.map((crop) => (
              <div key={crop.id} className="report-crop-chip">
                <div className="crop-chip-name">{crop.nameEn}</div>
                <div className={`crop-chip-score ${crop.score >= 80 ? 'high-match' : crop.score >= 60 ? 'medium-match' : 'low-match'}`}>
                  {crop.score}%
                </div>
              </div>
            ))}
          </div>
          <p className="text-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Scores reflect compatibility between this soil test's nutrient levels, pH, and each crop's minimum requirements.
            Visit the <strong>Crop Advisory</strong> page for detailed recommendations and fertilizer schedules.
          </p>
        </div>

        {/* ═══ Soil Improvement Recommendations ═══ */}
        <div className="report-section-box">
          <h3 className="report-box-title">
            <TrendingUp size={18} /> Soil Improvement Recommendations
          </h3>
          <div className="improvement-recs-list">
            {test.ph < 6.5 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Liming:</strong> Apply 200–400 kg Agricultural Lime (CaCO3) per acre 3–4 weeks before sowing to neutralize soil acidity.
                </div>
              </div>
            )}
            {test.ph > 7.5 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Gypsum Application:</strong> Apply 250 kg Gypsum + 2–3 tonnes organic compost per acre to manage alkalinity.
                </div>
              </div>
            )}
            {test.nitrogen < 140 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Nitrogen Boost:</strong> Apply Neem-Coated Urea in 2–3 split doses. Integrate green manuring with Dhaincha or Sunhemp.
                </div>
              </div>
            )}
            {test.phosphorus < 35 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Phosphorus Supplementation:</strong> Apply 50 kg DAP or 100 kg SSP per acre at the basal stage. Use PSB culture.
                </div>
              </div>
            )}
            {test.potassium < 150 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Potash Application:</strong> Apply 25–35 kg Muriate of Potash (MOP) per acre to boost crop drought resistance.
                </div>
              </div>
            )}
            {(test.organic_matter !== null && test.organic_matter < 2.5) && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Organic Matter:</strong> Incorporate 4–5 tonnes well-rotted FYM or 1.5 tonnes vermicompost per acre. Consider cover cropping.
                </div>
              </div>
            )}
            {(test.moisture !== null && test.moisture < 20) && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Moisture Management:</strong> Increase irrigation frequency and apply organic mulch (4–6 cm layer) to reduce evaporation.
                </div>
              </div>
            )}
            {deficiencies.length === 0 && (
              <div className="improvement-rec-item">
                <CheckCircle2 size={16} className="rec-icon" />
                <div>
                  <strong>Maintenance:</strong> All parameters are within acceptable ranges. Continue current soil management, organic mulching, and balanced fertilizer dosing.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Official Certification Signature Block */}
        <div className="report-signature-block">
          <div>
            <p className="sig-title">System Verified By:</p>
            <p className="sig-name">AgriNex Digital Soil Testing Platform</p>
            <span className="sig-id">Report ID: AGX-{test.id}-{new Date(test.tested_at).getFullYear()}</span>
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

export default SoilReportDetail;
