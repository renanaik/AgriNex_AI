import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, TestTube, Upload, History, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

function AnalyzeSoil() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const actionCards = [
    {
      id: 'test',
      title: t('soil_test'),
      description: 'Input chemical nutrient levels: Nitrogen (N), Phosphorus (P), Potassium (K), Soil pH, Organic Matter, and Moisture.',
      icon: TestTube,
      to: '/soil-test',
      btnText: '+ ' + t('add_soil_test'),
    },
    {
      id: 'upload',
      title: `${t('upload_image')} & AI Classifier`,
      description: 'Upload or capture soil images with live camera, classify into 7 soil categories using MobileNetV3 AI, and inspect texture with OpenCV.',
      icon: Upload,
      to: '/upload',
      btnText: t('upload_image'),
    },
    {
      id: 'history',
      title: t('soil_history'),
      description: 'Inspect previous laboratory and field soil analysis records, view historical trends, and evaluate field health over time.',
      icon: History,
      to: '/history',
      btnText: t('view_all') + ' ' + t('soil_history'),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <FlaskConical size={26} className="title-icon" />
          <div>
            <h1>{t('analyze_soil')}</h1>
            <p className="subtitle">{t('monitor_soil')}</p>
          </div>
        </div>
      </div>

      <div className="action-cards-grid">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className="hub-card" onClick={() => navigate(card.to)}>
              <div className="hub-card-icon-wrapper">
                <Icon size={28} className="hub-card-icon" />
              </div>
              <h3 className="hub-card-title">{card.title}</h3>
              <p className="hub-card-desc">{card.description}</p>
              <button
                className="primary-btn inline-btn hub-card-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(card.to);
                }}
              >
                <span>{card.btnText}</span> <ArrowRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AnalyzeSoil;

