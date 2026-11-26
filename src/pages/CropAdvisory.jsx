import React, { useState, useEffect, useMemo } from 'react';
import {
  Sprout,
  TreePine,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

// Agricultural Knowledge Base
const CROP_DATABASE = [
  {
    id: 'wheat',
    nameEn: 'Wheat (ઘઉં)',
    nameGu: 'ઘઉં (Wheat)',
    season: 'Rabi (Winter)',
    seasonGu: 'રવિ (શિયાળો)',
    idealPh: [6.0, 7.5],
    minN: 80,
    minP: 30,
    minK: 120,
    preferredSoil: ['Loamy', 'Clay', 'Silt'],
    expectedYield: '18 - 24 quintals/acre',
    waterRequirement: 'Medium',
    tipsEn: 'Sow in November-December. Apply 1/3 Nitrogen at sowing and remaining in two equal splits at crown root initiation and flowering.',
    tipsGu: 'નવેમ્બર-ડિસેમ્બરમાં વાવણી કરો. વાવણી વખતે ૧/૩ નાઇટ્રોજન અને બાકીનો બે સરખા ભાગમાં ફૂટ અને ફૂલ વખતે આપો.',
  },
  {
    id: 'cotton',
    nameEn: 'Cotton (કપાસ)',
    nameGu: 'કપાસ (Cotton)',
    season: 'Kharif (Monsoon)',
    seasonGu: 'ખરીફ (ચોમાસુ)',
    idealPh: [6.0, 8.0],
    minN: 100,
    minP: 40,
    minK: 150,
    preferredSoil: ['Clay', 'Loamy'],
    expectedYield: '10 - 15 quintals/acre',
    waterRequirement: 'High',
    tipsEn: 'Deep black clay or rich loamy soil is optimal. Monitor sucking pest pressure and avoid water stagnation.',
    tipsGu: 'ઊંડી કાળી માટી અથવા ગોરાડુ જમીન શ્રેષ્ઠ છે. ચૂસિયા જીવાતો પર નજર રાખો અને પાણી ભરાવા ન દો.',
  },
  {
    id: 'groundnut',
    nameEn: 'Groundnut (મગફળી)',
    nameGu: 'મગફળી (Groundnut)',
    season: 'Kharif / Summer',
    seasonGu: 'ખરીફ / ઉનાળુ',
    idealPh: [6.0, 7.5],
    minN: 40, // Legume fixes nitrogen
    minP: 40,
    minK: 100,
    preferredSoil: ['Sandy', 'Loamy'],
    expectedYield: '8 - 14 quintals/acre',
    waterRequirement: 'Medium',
    tipsEn: 'Well-drained sandy loam soil is best for peg formation. Add gypsum at 200 kg/acre at flowering for pod filling.',
    tipsGu: 'સૂયા બેસવા માટે સારી નિતારવાળી ગોરાડુ-રેતાળ જમીન શ્રેષ્ઠ છે. ફૂલ વખતે ૨૦૦ કિગ્રા/એકર જીપ્સમ આપવું.',
  },
  {
    id: 'chickpea',
    nameEn: 'Chickpea / Gram (ચણા)',
    nameGu: 'ચણા (Chickpea)',
    season: 'Rabi (Winter)',
    seasonGu: 'રવિ (શિયાળો)',
    idealPh: [6.0, 8.0],
    minN: 30, // Fixes atmospheric nitrogen
    minP: 35,
    minK: 80,
    preferredSoil: ['Loamy', 'Clay', 'Sandy'],
    expectedYield: '8 - 12 quintals/acre',
    waterRequirement: 'Low',
    tipsEn: 'Excellent nitrogen-restoring crop for low-fertility soils. Highly drought-tolerant with low irrigation needs.',
    tipsGu: 'ઓછી ફળદ્રુપ જમીન માટે જમીનમાં નાઇટ્રોજન પુનઃસ્થાપિત કરતો શ્રેષ્ઠ પાક. ઓછી સિંચાઈમાં પણ સારો પાકે છે.',
  },
  {
    id: 'mustard',
    nameEn: 'Mustard (રાયડો)',
    nameGu: 'રાયડો / સરસવ (Mustard)',
    season: 'Rabi (Winter)',
    seasonGu: 'રવિ (શિયાળો)',
    idealPh: [6.2, 7.8],
    minN: 70,
    minP: 30,
    minK: 90,
    preferredSoil: ['Sandy', 'Loamy'],
    expectedYield: '7 - 10 quintals/acre',
    waterRequirement: 'Low - Medium',
    tipsEn: 'Requires sulfur-enriched fertilizer for high oil content. Suitable for light-to-medium soils of Gujarat/North India.',
    tipsGu: 'તેલની ટકાવારી વધારવા સલ્ફરયુક્ત ખાતર જરૂરી છે. મધ્યમથી હલકી જમીન માટે ઉત્તમ છે.',
  },
  {
    id: 'maize',
    nameEn: 'Maize (મકાઈ)',
    nameGu: 'મકાઈ (Maize)',
    season: 'Kharif / Rabi',
    seasonGu: 'ખરીફ / રવિ',
    idealPh: [5.8, 7.5],
    minN: 110,
    minP: 45,
    minK: 130,
    preferredSoil: ['Loamy', 'Silt'],
    expectedYield: '20 - 30 quintals/acre',
    waterRequirement: 'Medium - High',
    tipsEn: 'High feeder crop requiring balanced NPK. Ensure adequate drainage to avoid root suffocation.',
    tipsGu: 'વધુ પોષક તત્ત્વો માગતો પાક. જમીનમાં પૂરતા નિતારની વ્યવસ્થા હોવી જરૂરી છે.',
  },
  {
    id: 'pearl_millet',
    nameEn: 'Bajra / Pearl Millet (બાજરી)',
    nameGu: 'બાજરી (Pearl Millet)',
    season: 'Kharif / Summer',
    seasonGu: 'ખરીફ / ઉનાળુ',
    idealPh: [6.5, 8.5],
    minN: 50,
    minP: 25,
    minK: 70,
    preferredSoil: ['Sandy', 'Loamy'],
    expectedYield: '12 - 18 quintals/acre',
    waterRequirement: 'Low (Drought Hardy)',
    tipsEn: 'Extremely resilient in sandy, saline, or drought-prone soils. Ideal when water is scarce.',
    tipsGu: 'રેતાળ અને ખારી જમીન તેમજ ઓછા વરસાદમાં પણ ટકી રહેતો ખૂબ જ સહનશીલ પાક છે.',
  },
  {
    id: 'paddy',
    nameEn: 'Paddy / Rice (ડાંગર)',
    nameGu: 'ડાંગર / ચોખા (Paddy)',
    season: 'Kharif (Monsoon)',
    seasonGu: 'ખરીફ (ચોમાસુ)',
    idealPh: [5.5, 7.2],
    minN: 100,
    minP: 40,
    minK: 120,
    preferredSoil: ['Clay', 'Silt'],
    expectedYield: '22 - 32 quintals/acre',
    waterRequirement: 'Very High',
    tipsEn: 'Thrives in heavy clay soil with high water retention capacity. Maintain 2-5 cm standing water during tillering.',
    tipsGu: 'વધુ પાણી સંગ્રહ ક્ષમતા ધરાવતી ચીકણી જમીનમાં શ્રેષ્ઠ પાકે છે.',
  },
];

function CropAdvisory() {
  const { t, language } = useLanguage();

  const [farms, setFarms] = useState([]);
  const [soilTests, setSoilTests] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('all');
  const [loading, setLoading] = useState(true);

  // Custom Soil Parameters (can be overridden by farmer)
  const [customParams, setCustomParams] = useState({
    nitrogen: 120,
    phosphorus: 40,
    potassium: 160,
    ph: 6.8,
    moisture: 25,
    soilType: 'Loamy',
  });

  // Load farms & soil tests
  useEffect(() => {
    async function loadData() {
      try {
        const [farmsRes, testsRes] = await Promise.allSettled([
          api.get('/api/farms'),
          api.get('/api/soil-tests'),
        ]);

        if (farmsRes.status === 'fulfilled' && Array.isArray(farmsRes.value.data)) {
          setFarms(farmsRes.value.data);
          if (farmsRes.value.data.length > 0) {
            setSelectedFarmId(farmsRes.value.data[0].id.toString());
          }
        }

        if (testsRes.status === 'fulfilled' && Array.isArray(testsRes.value.data)) {
          setSoilTests(testsRes.value.data);
        }
      } catch (err) {
        console.error('Failed to load advisory data', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Sync customParams when selectedFarm changes
  useEffect(() => {
    if (!selectedFarmId) return;

    const farmIdNum = parseInt(selectedFarmId, 10);
    const farm = farms.find((f) => f.id === farmIdNum);
    const testsForFarm = soilTests
      .filter((t) => t.farm_id === farmIdNum)
      .sort((a, b) => new Date(b.tested_at) - new Date(a.tested_at));

    const latestTest = testsForFarm[0];

    if (latestTest) {
      setCustomParams({
        nitrogen: latestTest.nitrogen,
        phosphorus: latestTest.phosphorus,
        potassium: latestTest.potassium,
        ph: latestTest.ph,
        moisture: latestTest.moisture || 25,
        soilType: farm?.soil_type || 'Loamy',
      });
    } else if (farm) {
      setCustomParams((prev) => ({
        ...prev,
        soilType: farm.soil_type || 'Loamy',
      }));
    }
  }, [selectedFarmId, farms, soilTests]);

  // Calculate Suitability Score for each crop
  const evaluatedCrops = useMemo(() => {
    const { nitrogen, phosphorus, potassium, ph, soilType } = customParams;

    return CROP_DATABASE.map((crop) => {
      let score = 100;
      const reasons = [];

      // 1. pH evaluation (35% weight)
      if (ph < crop.idealPh[0]) {
        const diff = crop.idealPh[0] - ph;
        score -= diff * 20;
        reasons.push(
          language === 'gu'
            ? `જમીન વધુ એસિડિક છે (જરૂરી: ${crop.idealPh[0]} - ${crop.idealPh[1]})`
            : `Soil is too acidic (needs pH ${crop.idealPh[0]} - ${crop.idealPh[1]})`
        );
      } else if (ph > crop.idealPh[1]) {
        const diff = ph - crop.idealPh[1];
        score -= diff * 18;
        reasons.push(
          language === 'gu'
            ? `જમીન વધુ આલ્કલાઇન છે (જરૂરી: ${crop.idealPh[0]} - ${crop.idealPh[1]})`
            : `Soil is too alkaline (needs pH ${crop.idealPh[0]} - ${crop.idealPh[1]})`
        );
      } else {
        reasons.push(
          language === 'gu'
            ? `જમીનનું pH સ્તર (${ph}) આ પાક માટે ઉત્તમ છે`
            : `Optimal soil pH (${ph}) for this crop`
        );
      }

      // 2. Nitrogen evaluation (25% weight)
      if (nitrogen < crop.minN) {
        const deficit = crop.minN - nitrogen;
        score -= Math.min(25, (deficit / crop.minN) * 25);
        reasons.push(
          language === 'gu'
            ? `નાઇટ્રોજનની ઘટ છે (${nitrogen} mg/kg, ભલામણ: ${crop.minN}+)`
            : `Nitrogen deficit (${nitrogen} mg/kg vs ${crop.minN}+ needed)`
        );
      }

      // 3. Phosphorus evaluation (20% weight)
      if (phosphorus < crop.minP) {
        const deficit = crop.minP - phosphorus;
        score -= Math.min(20, (deficit / crop.minP) * 20);
        reasons.push(
          language === 'gu'
            ? `ફોસ્ફરસ ઓછું છે (${phosphorus} mg/kg, ભલામણ: ${crop.minP}+)`
            : `Low Phosphorus (${phosphorus} mg/kg vs ${crop.minP}+ needed)`
        );
      }

      // 4. Potassium evaluation (10% weight)
      if (potassium < crop.minK) {
        const deficit = crop.minK - potassium;
        score -= Math.min(10, (deficit / crop.minK) * 10);
      }

      // 5. Soil Type Match (10% weight)
      if (soilType && crop.preferredSoil.includes(soilType)) {
        score += 5;
        reasons.push(
          language === 'gu'
            ? `${soilType} જમીન આ પાકના મૂળ માટે અનુકૂળ છે`
            : `${soilType} soil structure matches root penetration needs`
        );
      }

      const finalScore = Math.max(15, Math.min(98, Math.round(score)));

      return {
        ...crop,
        score: finalScore,
        reasons,
      };
    })
      .filter((crop) => {
        if (selectedSeason === 'all') return true;
        return crop.season.toLowerCase().includes(selectedSeason.toLowerCase());
      })
      .sort((a, b) => b.score - a.score);
  }, [customParams, selectedSeason, language]);

  // Fertilizer recommendations
  const fertilizerAdvice = useMemo(() => {
    const { nitrogen, phosphorus, potassium, ph } = customParams;
    const advice = [];

    // Nitrogen advice
    if (nitrogen < 80) {
      advice.push({
        title: language === 'gu' ? 'નાઇટ્રોજન પૂર્તિ (Nitrogen)' : 'Nitrogen Replenishment Needed',
        dosage: '45 - 55 kg Urea / acre in 2 split applications',
        dosageGu: '૪૫ - ૫૫ કિગ્રા યુરિયા / એકર (બે હપ્તામાં)',
        desc: language === 'gu'
          ? 'જમીનમાં નાઇટ્રોજન ઓછું છે. લીલો ખાતર (સણ/ઇકકડ) અથવા વર્મીકમ્પોસ્ટ આપવાથી નાઇટ્રોજન લાંબા સમય સુધી જળવાઈ રહેશે.'
          : 'Low nitrogen levels detected. Apply neem-coated urea and integrate green manuring (Dhaincha/Sunhemp) to boost long-term soil fertility.',
        priority: 'high',
      });
    } else if (nitrogen > 220) {
      advice.push({
        title: language === 'gu' ? 'નાઇટ્રોજન વધુ છે' : 'High Nitrogen Warning',
        dosage: 'Reduce synthetic urea by 30-40%',
        dosageGu: 'રાસાયણિક યુરિયામાં ૩૦-૪૦% ઘટાડો કરો',
        desc: language === 'gu'
          ? 'વધુ પડતો નાઇટ્રોજન પાકમાં રોગ-જીવાત વધારે છે અને દાણા કરતાં પાંદડા વધુ વધારે છે.'
          : 'Excessive nitrogen promotes vegetative growth over grain production and invites sucking pests. Cut back on urea.',
        priority: 'medium',
      });
    }

    // Phosphorus advice
    if (phosphorus < 35) {
      advice.push({
        title: language === 'gu' ? 'ફોસ્ફરસ ખાતર (DAP / SSP)' : 'Phosphorus Supplementation',
        dosage: '50 kg DAP or 100 kg SSP / acre at basal stage',
        dosageGu: '૫૦ કિગ્રા ડીએપી અથવા ૧૦૦ કિગ્રા એસએસપી / એકર (વાવણી વખતે)',
        desc: language === 'gu'
          ? 'મૂળના વિકાસ અને દાણાની ભરાવદારતા માટે ફોસ્ફરસ જરૂરી છે. PSB (ફોસ્ફેટ સોલ્યુબિલાઇઝિંગ બેક્ટેરિયા) વાપરવાની ભલામણ છે.'
          : 'Crucial for root proliferation and early plant vigor. Apply Phosphorus Solubilizing Bacteria (PSB) with FYM.',
        priority: 'high',
      });
    }

    // Potassium advice
    if (potassium < 140) {
      advice.push({
        title: language === 'gu' ? 'પોટાશ ખાતર (MOP)' : 'Potassium / Potash Boost',
        dosage: '25 - 35 kg MOP (Muriate of Potash) / acre',
        dosageGu: '૨૫ - ૩૫ કિગ્રા એમઓપી / એકર',
        desc: language === 'gu'
          ? 'પાકમાં રોગ પ્રતિકારક શક્તિ અને દાણાની ગુણવત્તા વધારવા પોટાશ જરૂરી છે.'
          : 'Improves drought resilience, stem strength, and disease resistance. Essential for pest defense.',
        priority: 'medium',
      });
    }

    // pH adjustment
    if (ph < 6.0) {
      advice.push({
        title: language === 'gu' ? 'એસિડિક જમીન સુધારણા (Soil Liming)' : 'Soil Acidity Amendment',
        dosage: '200 - 300 kg Agricultural Lime (CaCO3) / acre',
        dosageGu: '૨૦૦ - ૩૦૦ કિગ્રા કૃષિ ચૂનો / એકર',
        desc: language === 'gu'
          ? 'જમીન એસિડિક હોવાથી પોષક તત્ત્વો છોડને સરળતાથી મળતા નથી. ચૂનો ઉમેરવાથી pH નિયંત્રિત થશે.'
          : 'Low pH restricts nutrient uptake. Apply agricultural lime 3-4 weeks prior to sowing.',
        priority: 'high',
      });
    } else if (ph > 8.0) {
      advice.push({
        title: language === 'gu' ? 'આલ્કલાઇન જમીન સુધારણા (Gypsum)' : 'Soil Alkalinity Amendment',
        dosage: '250 kg Agricultural Gypsum + 2 tons Farm Yard Manure / acre',
        dosageGu: '૨૫૦ કિગ્રા જીપ્સમ + ૨ ટન છાણીયું ખાતર / એકર',
        desc: language === 'gu'
          ? 'જમીનમાં ક્ષાર અને આલ્કલી વધુ છે. જીપ્સમ અને દેશી છાણીયું ખાતર આપવાથી જમીન પોચી બનશે.'
          : 'High pH locks micronutrients like Zinc and Iron. Apply gypsum and organic compost to displace sodium.',
        priority: 'high',
      });
    }

    // General FYM advice
    advice.push({
      title: language === 'gu' ? 'સજીવ કાર્બન સંવર્ધન (Organic Matter)' : 'Organic Carbon & Soil Health',
      dosage: '3 - 5 tonnes Well-rotted FYM or 1.5 tonnes Vermicompost / acre',
      dosageGu: '૩ - ૫ ટન સારું કોહવાયેલું છાણીયું ખાતર અથવા ૧.૫ ટન વર્મીકમ્પોસ્ટ',
      desc: language === 'gu'
        ? 'કાર્બનિક પદાર્થ જમીનમાં ભેજ સંગ્રહ ક્ષમતા વધારે છે અને સૂક્ષ્મ જીવાણુઓની પ્રવૃત્તિ તેજ બનાવે છે.'
        : 'Restores biological microbial activity and moisture retention in the root zone.',
      priority: 'low',
    });

    return advice;
  }, [customParams, language]);

  return (
    <div className="page-container">
      <div className="page-header-flex">
        <div className="page-title-group">
          <Sprout size={26} className="title-icon" />
          <div>
            <h1>{t('crop_advisory')}</h1>
            <p className="subtitle">
              {language === 'gu'
                ? 'તમારી જમીનના પોષક તત્ત્વો આધારિત વૈજ્ઞાનિક પાક ભલામણો અને ખાતર માર્ગદર્શન'
                : 'Scientific crop suitability, fertilizer scheduling, and soil amendments based on live soil test records'}
            </p>
          </div>
        </div>
      </div>

      {/* Farm Selection & Parameters Header */}
      <div className="advisory-control-card">
        <div className="advisory-control-grid">
          <div className="form-group">
            <label htmlFor="farm-select">
              <TreePine size={16} /> {t('select_farm')}
            </label>
            <select
              id="farm-select"
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="form-control"
            >
              <option value="">-- {t('select_farm')} --</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farm_name} {f.field_name ? `(${f.field_name})` : ''} - {f.soil_type || 'Field'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="season-filter">
              <Calendar size={16} /> Filter Season
            </label>
            <select
              id="season-filter"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="form-control"
            >
              <option value="all">All Seasons (બધી ઋતુઓ)</option>
              <option value="kharif">Kharif / Monsoon (ખરીફ)</option>
              <option value="rabi">Rabi / Winter (રવિ)</option>
              <option value="summer">Summer / Zaid (ઉનાળુ)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="soil-type">
              <Layers size={16} /> {t('soil_type')}
            </label>
            <select
              id="soil-type"
              value={customParams.soilType}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, soilType: e.target.value }))}
              className="form-control"
            >
              <option value="Loamy">Loamy (ગોરાડુ)</option>
              <option value="Clay">Clay (ચીકણી / કાળી)</option>
              <option value="Sandy">Sandy (રેતાળ)</option>
              <option value="Silt">Silt (કાંપવાળી)</option>
              <option value="Peaty">Peaty (પીટ)</option>
            </select>
          </div>
        </div>

        {/* Live Soil Nutrient Sliders / Quick Adjust */}
        <div className="nutrient-pills-bar">
          <div className="nutrient-chip">
            <span className="chip-label">pH:</span>
            <input
              type="number"
              step="0.1"
              min="4"
              max="10"
              value={customParams.ph}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, ph: parseFloat(e.target.value) || 7 }))}
              className="chip-input"
            />
          </div>

          <div className="nutrient-chip">
            <span className="chip-label">N:</span>
            <input
              type="number"
              value={customParams.nitrogen}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, nitrogen: parseFloat(e.target.value) || 0 }))}
              className="chip-input"
            />
            <span className="chip-unit">mg/kg</span>
          </div>

          <div className="nutrient-chip">
            <span className="chip-label">P:</span>
            <input
              type="number"
              value={customParams.phosphorus}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, phosphorus: parseFloat(e.target.value) || 0 }))}
              className="chip-input"
            />
            <span className="chip-unit">mg/kg</span>
          </div>

          <div className="nutrient-chip">
            <span className="chip-label">K:</span>
            <input
              type="number"
              value={customParams.potassium}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, potassium: parseFloat(e.target.value) || 0 }))}
              className="chip-input"
            />
            <span className="chip-unit">mg/kg</span>
          </div>

          <div className="nutrient-chip">
            <span className="chip-label">Moisture:</span>
            <input
              type="number"
              value={customParams.moisture}
              onChange={(e) => setCustomParams((prev) => ({ ...prev, moisture: parseFloat(e.target.value) || 0 }))}
              className="chip-input"
            />
            <span className="chip-unit">%</span>
          </div>
        </div>
      </div>

      {/* Main Section: Top Recommended Crops */}
      <div className="advisory-section">
        <div className="section-heading">
          <h2>
            <Sparkles size={20} className="title-icon" /> Top Suitable Crops (શ્રેષ્ઠ પાક ભલામણ)
          </h2>
          <span className="text-muted">Ranked by nutrient & soil compatibility score</span>
        </div>

        <div className="crop-cards-grid">
          {evaluatedCrops.map((crop) => (
            <div key={crop.id} className="crop-recommendation-card">
              <div className="crop-card-top">
                <div>
                  <h3 className="crop-name">
                    {language === 'gu' ? crop.nameGu : crop.nameEn}
                  </h3>
                  <span className="crop-season-pill">
                    {language === 'gu' ? crop.seasonGu : crop.season}
                  </span>
                </div>

                <div className={`match-score-badge ${crop.score >= 80 ? 'high-match' : crop.score >= 60 ? 'medium-match' : 'low-match'}`}>
                  <span className="score-num">{crop.score}%</span>
                  <span className="score-label">Match</span>
                </div>
              </div>

              <div className="crop-meta-row">
                <div className="meta-col">
                  <span className="meta-title">Est. Yield</span>
                  <span className="meta-val">{crop.expectedYield}</span>
                </div>
                <div className="meta-col">
                  <span className="meta-title">Water Req.</span>
                  <span className="meta-val">{crop.waterRequirement}</span>
                </div>
                <div className="meta-col">
                  <span className="meta-title">Ideal pH</span>
                  <span className="meta-val">{crop.idealPh[0]} - {crop.idealPh[1]}</span>
                </div>
              </div>

              <div className="crop-reasons-list">
                {crop.reasons.map((r, i) => (
                  <div key={i} className="crop-reason-item">
                    <CheckCircle2 size={14} className="reason-check-icon" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              <div className="crop-card-footer">
                <p className="crop-tip-text">
                  <strong>Advice: </strong>
                  {language === 'gu' ? crop.tipsGu : crop.tipsEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fertilizer & Soil Health Amendments */}
      <div className="content-section">
        <div className="section-heading">
          <h2>
            <TrendingUp size={20} className="title-icon" /> Fertilizer & Soil Amendment Schedule
          </h2>
          <span className="text-muted">Targeted recommendations based on nutrient deficits</span>
        </div>

        <div className="fertilizer-cards-grid">
          {fertilizerAdvice.map((item, idx) => (
            <div key={idx} className={`fertilizer-card priority-${item.priority}`}>
              <div className="fert-header">
                <h4>{item.title}</h4>
                <span className={`priority-tag ${item.priority}`}>
                  {item.priority === 'high' ? 'High Priority' : item.priority === 'medium' ? 'Recommended' : 'Maintenance'}
                </span>
              </div>
              <div className="fert-dosage-box">
                <strong>Recommended Dosage: </strong>
                <span>{language === 'gu' ? item.dosageGu : item.dosage}</span>
              </div>
              <p className="fert-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CropAdvisory;
