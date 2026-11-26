import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Cpu,
  CheckCircle2,
  Maximize2,
  X,
  RefreshCw,
  Sparkles,
  Brain,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Layers,
  MapPin,
  TestTube,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import CameraCapture from '../components/CameraCapture';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function SoilImageUpload() {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [availableSoilTests, setAvailableSoilTests] = useState([]);
  const [selectedSoilTestId, setSelectedSoilTestId] = useState('');

  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'camera'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [viewingImage, setViewingImage] = useState(null);
  const [galleryFilterFarm, setGalleryFilterFarm] = useState('');

  // AI Soil Classification States
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);
  const [classificationError, setClassificationError] = useState(null);
  const [showProbabilities, setShowProbabilities] = useState(false);
  const [galleryClassifyingId, setGalleryClassifyingId] = useState(null);

  // Load farms & initial user images
  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        const [farmsRes, imagesRes] = await Promise.allSettled([
          api.get('/api/farms'),
          api.get('/api/images'),
        ]);

        if (!mounted) return;

        if (farmsRes.status === 'fulfilled' && Array.isArray(farmsRes.value.data)) {
          setFarms(farmsRes.value.data);
          // Pre-select first farm if available
          if (farmsRes.value.data.length > 0) {
            setSelectedFarmId(String(farmsRes.value.data[0].id));
          }
        }
        if (imagesRes.status === 'fulfilled' && Array.isArray(imagesRes.value.data)) {
          setImages(imagesRes.value.data);
        }
      } catch (err) {
        console.error('Error loading image upload data', err);
      } finally {
        if (mounted) setLoadingImages(false);
      }
    }

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  // When selectedFarmId changes, load available soil tests for that farm
  useEffect(() => {
    if (!selectedFarmId) {
      setAvailableSoilTests([]);
      setSelectedSoilTestId('');
      return;
    }

    api
      .get(`/api/soil-tests?farm_id=${selectedFarmId}`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAvailableSoilTests(res.data);
        }
      })
      .catch((err) => {
        console.error('Error fetching farm soil tests', err);
        setAvailableSoilTests([]);
      });
  }, [selectedFarmId]);

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file) => {
    if (!file) return false;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Invalid file format .${ext}. Only JPG, JPEG, PNG, and WEBP are allowed.`);
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is 10MB.`);
      return false;
    }

    return true;
  };

  const handleFileSelection = (file) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      setClassificationResult(null);
      setClassificationError(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Upload and persistently store image + run & save AI classification
  const handleUploadAndAnalyze = async (e) => {
    if (e) e.preventDefault();

    if (!selectedFarmId) {
      toast.error(t('select_farm_required') || 'Please select a farm for this soil image');
      return;
    }

    if (!selectedFile) {
      toast.error(t('select_image'));
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('farm_id', selectedFarmId);
    if (selectedSoilTestId) {
      formData.append('soil_test_id', selectedSoilTestId);
    }

    try {
      setUploading(true);
      setClassificationError(null);

      const res = await api.post('/api/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedImage = res.data;
      toast.success(t('upload_success'));

      // If backend attached the persistent AI classification, show results immediately
      if (uploadedImage.latest_analysis) {
        setClassificationResult(uploadedImage.latest_analysis);
        toast.success(
          `${t('predicted_soil')}: ${uploadedImage.latest_analysis.predicted_soil_name} (${uploadedImage.latest_analysis.confidence}%)`
        );
      }

      setImages((prev) => [uploadedImage, ...prev]);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const msg = err.response?.data?.detail || t('upload_error');
      setClassificationError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // Re-run or run classification on an already stored image
  const handleClassifyStoredImage = async (img) => {
    try {
      setGalleryClassifyingId(img.id);
      const res = await api.post(`/api/images/${img.id}/classify`);
      toast.success(`${img.original_filename}: ${res.data.predicted_soil_name} (${res.data.confidence}%)`);

      // Update image record in list with new latest_analysis
      setImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, latest_analysis: res.data } : item))
      );

      if (viewingImage && viewingImage.id === img.id) {
        setViewingImage((prev) => ({ ...prev, latest_analysis: res.data }));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to classify stored image.');
    } finally {
      setGalleryClassifyingId(null);
    }
  };

  const handleProcessImage = async (id) => {
    try {
      setProcessingId(id);
      const res = await api.post(`/api/images/${id}/process`);
      toast.success('OpenCV CLAHE image preprocessing completed!');
      const updated = { ...res.data, _timestamp: Date.now() };
      setImages((prev) => prev.map((img) => (img.id === id ? updated : img)));
      if (viewingImage && viewingImage.id === id) {
        setViewingImage(updated);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Image preprocessing failed';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteImage = async (id) => {
    if (!window.confirm(t('confirm_delete'))) return;

    try {
      await api.delete(`/api/images/${id}`);
      toast.success(t('image_deleted'));
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (viewingImage && viewingImage.id === id) {
        setViewingImage(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete image');
    }
  };

  const getImageUrl = (imgId, isProcessed = false, ts) => {
    const endpoint = isProcessed ? 'processed' : 'file';
    const currentToken = token || localStorage.getItem('token');
    return `http://localhost:8000/api/images/${imgId}/${endpoint}?token=${encodeURIComponent(currentToken || '')}${
      ts ? `&ts=${ts}` : ''
    }`;
  };

  const getFarmDisplayName = (farmId) => {
    if (!farmId) return t('no_farm_selected');
    const f = farms.find((farm) => farm.id === farmId);
    if (!f) return `Farm #${farmId}`;
    return f.farm_name + (f.field_name ? ` (${f.field_name})` : '');
  };

  // Filter gallery images by selected farm filter if set
  const filteredGalleryImages = galleryFilterFarm
    ? images.filter((img) => String(img.farm_id) === String(galleryFilterFarm))
    : images;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <ImageIcon size={26} className="title-icon" />
          <div>
            <h1>{t('upload_image')} & AI Soil Classifier</h1>
            <p className="subtitle">
              Upload soil photographs, link them to your farms, store metadata in PostgreSQL, and classify using trained MobileNetV3 AI.
            </p>
          </div>
        </div>
      </div>

      <div className="upload-layout-grid">
        {/* Upload Card */}
        <div className="form-card upload-form-card">
          {/* Farm Association Selector (Required) */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="farm_select" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <MapPin size={16} /> {t('select_farm')} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="farm_select"
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="form-control"
              required
            >
              <option value="">-- {t('select_farm')} ({t('required') || 'Required'}) --</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farm_name} {farm.field_name ? `(${farm.field_name})` : ''} - {farm.location || 'Field'}
                </option>
              ))}
            </select>
            {farms.length === 0 && (
              <small style={{ color: '#b45309', display: 'block', marginTop: 4 }}>
                No farms registered yet. Please create a farm first under My Farms.
              </small>
            )}
          </div>

          {/* Optional Soil Test Linkage */}
          {selectedFarmId && availableSoilTests.length > 0 && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="soil_test_select" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TestTube size={15} /> {t('link_soil_test')}
              </label>
              <select
                id="soil_test_select"
                value={selectedSoilTestId}
                onChange={(e) => setSelectedSoilTestId(e.target.value)}
                className="form-control"
              >
                <option value="">-- None (Standalone Soil Image) --</option>
                {availableSoilTests.map((st) => (
                  <option key={st.id} value={st.id}>
                    Soil Test #{st.id} ({new Date(st.tested_at).toLocaleDateString()}) - pH: {st.ph}, Status: {st.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode Switcher: File Upload vs Live Camera */}
          <div className="upload-mode-switcher">
            <button
              type="button"
              className={`mode-switch-btn ${uploadMode === 'file' ? 'active' : ''}`}
              onClick={() => setUploadMode('file')}
            >
              <Upload size={16} /> {t('file_upload')}
            </button>
            <button
              type="button"
              className={`mode-switch-btn ${uploadMode === 'camera' ? 'active' : ''}`}
              onClick={() => setUploadMode('camera')}
            >
              <Camera size={16} /> {t('live_camera')}
            </button>
          </div>

          {uploadMode === 'camera' ? (
            <CameraCapture
              onPhotoSelected={(capturedFile) => {
                handleFileSelection(capturedFile);
                setUploadMode('file');
                toast.success('Soil photo captured! Click Upload & Analyze to save to farm history.');
              }}
              onClose={() => setUploadMode('file')}
            />
          ) : (
            <form onSubmit={handleUploadAndAnalyze}>
              {/* Drop Zone */}
              <div
                className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />

                {previewUrl ? (
                  <div className="preview-container">
                    <img src={previewUrl} alt={t('image_preview')} className="upload-preview-image" />
                    <p className="file-info-text">
                      {selectedFile?.name} ({(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                    <span className="change-image-hint">Click or drag another image to replace</span>
                  </div>
                ) : (
                  <div className="drop-zone-prompt">
                    <Upload size={40} className="upload-icon" />
                    <h4>{t('drag_drop')}</h4>
                    <p>JPG, JPEG, PNG, WEBP (Max 10MB)</p>
                    <div className="drop-zone-divider">
                      <span>OR</span>
                    </div>
                    <button
                      type="button"
                      className="open-camera-inline-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadMode('camera');
                      }}
                    >
                      <Camera size={16} /> {t('open_camera')}
                    </button>
                  </div>
                )}
              </div>

              <div className="form-actions">
                {selectedFile && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setSelectedFile(null);
                      setClassificationResult(null);
                      setClassificationError(null);
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={uploading || classifying}
                  >
                    {t('cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!selectedFile || !selectedFarmId || uploading || classifying}
                  style={{ minWidth: 200 }}
                >
                  {uploading ? (
                    <>
                      <span className="btn-spinner"></span> Saving & Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Upload & Analyze Soil
                    </>
                  )}
                </button>
              </div>

              {/* AI Soil Classification Results Card */}
              {classificationResult && (
                <div className="ai-result-card" style={{ marginTop: 24 }}>
                  <div className="ai-result-header">
                    <div className="ai-result-title-group">
                      <Sparkles size={18} className="ai-icon-sparkle" />
                      <h4>{t('ai_soil_classification')}</h4>
                    </div>
                    <span className="ai-model-tag">{classificationResult.model_name || t('ai_model_name')}</span>
                  </div>

                  <div className="ai-prediction-hero">
                    <div className="ai-soil-name-box">
                      <span className="ai-soil-label">{t('predicted_soil')}</span>
                      <span className="ai-soil-pred-name">
                        {language === 'gu' && classificationResult.soil_info?.name_gu
                          ? classificationResult.soil_info.name_gu
                          : classificationResult.predicted_soil_name || classificationResult.predicted_soil_type?.replace('_', ' ')}
                      </span>
                    </div>

                    <div
                      className={`ai-confidence-pill ${
                        classificationResult.confidence >= 70
                          ? 'high'
                          : classificationResult.confidence >= 50
                          ? 'medium'
                          : 'low'
                      }`}
                    >
                      <Brain size={16} />
                      <span>{classificationResult.confidence}% {t('confidence')}</span>
                    </div>
                  </div>

                  {classificationResult.soil_info && (
                    <div className="ai-soil-details-grid">
                      <div className="ai-detail-item">
                        <strong>{t('characteristics')}</strong>
                        <p>{classificationResult.soil_info.characteristics}</p>
                      </div>
                      <div className="ai-detail-item">
                        <strong>{t('suitable_crops')}</strong>
                        <p>{classificationResult.soil_info.typical_crops}</p>
                      </div>
                    </div>
                  )}

                  {/* 7-class probability breakdown */}
                  {classificationResult.probabilities && (
                    <>
                      <button
                        type="button"
                        className="ai-probabilities-toggle-btn"
                        onClick={() => setShowProbabilities((prev) => !prev)}
                      >
                        <span>
                          <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
                          {t('probability_breakdown')} (7 Classes)
                        </span>
                        {showProbabilities ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {showProbabilities && (
                        <div className="ai-probabilities-list">
                          {Object.entries(classificationResult.probabilities).map(([clsName, probVal]) => {
                            const isWinner =
                              clsName === classificationResult.predicted_soil_type ||
                              clsName === classificationResult.predicted_soil;
                            const displayName = clsName.replace('_', ' ');
                            return (
                              <div key={clsName} className="prob-row">
                                <span className={`prob-label ${isWinner ? 'highlight' : ''}`} title={clsName}>
                                  {displayName}
                                </span>
                                <div className="prob-track">
                                  <div
                                    className={`prob-fill ${isWinner ? 'winner' : ''}`}
                                    style={{ width: `${Math.min(100, Math.max(0, probVal))}%` }}
                                  />
                                </div>
                                <span className={`prob-value ${isWinner ? 'highlight' : ''}`}>
                                  {probVal}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* ML Limitation Notice */}
                  <div className="ai-disclaimer-box">
                    <Info size={16} />
                    <div>
                      <strong>{t('ml_disclaimer_title')}: </strong>
                      {classificationResult.disclaimer}
                    </div>
                  </div>
                </div>
              )}

              {/* Classification Error Message */}
              {classificationError && (
                <div
                  className="ai-disclaimer-box"
                  style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', marginTop: 16 }}
                >
                  <AlertCircle size={16} style={{ color: '#ef4444' }} />
                  <div>
                    <strong>Upload / Analysis Failed: </strong>
                    {classificationError}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Gallery / History of Uploaded Images */}
        <div className="uploaded-gallery-section">
          <div className="gallery-header-flex">
            <div>
              <h3>Farm Soil Image History</h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Persistent images stored in PostgreSQL and server storage
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} style={{ color: '#64748b' }} />
                <select
                  value={galleryFilterFarm}
                  onChange={(e) => setGalleryFilterFarm(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                  }}
                >
                  <option value="">{t('all_farms') || 'All Farms'}</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.farm_name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="gallery-count">{filteredGalleryImages.length} images</span>
            </div>
          </div>

          {loadingImages ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>{t('loading')}</p>
            </div>
          ) : filteredGalleryImages.length === 0 ? (
            <div className="empty-state-card small-empty-card">
              <ImageIcon size={36} className="empty-state-icon" />
              <p>{t('no_images')}</p>
              <small style={{ color: '#94a3b8' }}>
                {galleryFilterFarm
                  ? 'No soil images uploaded for this farm yet.'
                  : 'Select a farm above and upload your first soil photograph.'}
              </small>
            </div>
          ) : (
            <div className="image-cards-grid">
              {filteredGalleryImages.map((img) => {
                const analysis = img.latest_analysis;
                return (
                  <div key={img.id} className="image-card">
                    <div className="image-card-preview-pair">
                      <div className="image-preview-box" onClick={() => setViewingImage(img)}>
                        <span className="img-badge original-badge">{t('original')}</span>
                        <img
                          src={getImageUrl(img.id, false, img._timestamp)}
                          alt={img.original_filename}
                          className="soil-thumbnail"
                          loading="lazy"
                        />
                        <button className="preview-zoom-btn" title="Expand View">
                          <Maximize2 size={14} />
                        </button>
                      </div>

                      <div className="image-preview-box" onClick={() => img.processed_path && setViewingImage(img)}>
                        <span className={`img-badge ${img.processed_path ? 'processed-badge' : 'pending-badge'}`}>
                          {img.processed_path ? `${t('processed')} (OpenCV)` : 'Not Processed'}
                        </span>
                        {img.processed_path ? (
                          <>
                            <img
                              src={getImageUrl(img.id, true, img._timestamp)}
                              alt="OpenCV Processed Soil"
                              className="soil-thumbnail"
                              loading="lazy"
                            />
                            <button className="preview-zoom-btn" title="Expand View">
                              <Maximize2 size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="unprocessed-placeholder">
                            <Cpu size={24} className="unprocessed-icon" />
                            <span>Click process below to run OpenCV CLAHE</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="image-card-details">
                      <p className="image-filename" title={img.original_filename}>
                        {img.original_filename}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 6px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <MapPin size={10} /> {getFarmDisplayName(img.farm_id)}
                        </span>

                        {img.soil_test_id && (
                          <span
                            style={{
                              fontSize: 11,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 6px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <TestTube size={10} /> Test #{img.soil_test_id}
                          </span>
                        )}
                      </div>

                      <p className="image-meta">
                        {(img.file_size / 1024).toFixed(1)} KB • {new Date(img.uploaded_at).toLocaleDateString()}
                      </p>

                      {/* Persistent AI Analysis status tag */}
                      {analysis ? (
                        <div style={{ marginTop: 6, marginBottom: 8 }}>
                          <span className="gallery-ai-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Sparkles size={11} /> {analysis.predicted_soil_name || analysis.predicted_soil_type.replace('_', ' ')}: {analysis.confidence}%
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {t('pending_analysis') || 'Not Analyzed'}
                          </span>
                        </div>
                      )}

                      <div className="image-card-buttons">
                        <button
                          type="button"
                          className="gallery-classify-btn"
                          onClick={() => handleClassifyStoredImage(img)}
                          disabled={galleryClassifyingId === img.id}
                          title="Run or re-run MobileNetV3 AI Soil Classification"
                        >
                          {galleryClassifyingId === img.id ? (
                            <>
                              <span className="btn-spinner"></span> {t('classifying')}
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} /> {analysis ? 'Re-Analyze' : 'Analyze (AI)'}
                            </>
                          )}
                        </button>

                        {!img.processed_path ? (
                          <button
                            className="process-btn"
                            onClick={() => handleProcessImage(img.id)}
                            disabled={processingId === img.id}
                          >
                            {processingId === img.id ? (
                              <>
                                <span className="btn-spinner"></span> Processing...
                              </>
                            ) : (
                              <>
                                <Cpu size={14} /> OpenCV
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            className="reprocess-btn"
                            onClick={() => handleProcessImage(img.id)}
                            disabled={processingId === img.id}
                            title="Run OpenCV Preprocessing Again"
                          >
                            {processingId === img.id ? (
                              <span className="btn-spinner"></span>
                            ) : (
                              <>
                                <RefreshCw size={13} /> Reprocess
                              </>
                            )}
                          </button>
                        )}

                        <button
                          className="delete-icon-btn"
                          onClick={() => handleDeleteImage(img.id)}
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full Modal Viewer for Side-by-Side Comparison & Detailed Analysis */}
      {viewingImage && (
        <div className="image-modal-backdrop" onClick={() => setViewingImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 960 }}>
            <div className="image-modal-header">
              <div>
                <h3>Soil Image: {viewingImage.original_filename}</h3>
                <p className="modal-subtitle">
                  Farm: {getFarmDisplayName(viewingImage.farm_id)} • Uploaded: {new Date(viewingImage.uploaded_at).toLocaleString()}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setViewingImage(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-comparison-grid">
              <div className="modal-image-col">
                <div className="col-header">
                  <span className="badge-tag original-tag">{t('original')} Image</span>
                  <span className="badge-detail">Original RGB upload</span>
                </div>
                <div className="modal-img-wrapper">
                  <img src={getImageUrl(viewingImage.id, false, viewingImage._timestamp)} alt="Original" />
                </div>
              </div>

              <div className="modal-image-col">
                <div className="col-header">
                  <span className="badge-tag processed-tag">OpenCV CLAHE Enhanced</span>
                  <span className="badge-detail">Texture & Granular Contrast</span>
                </div>
                <div className="modal-img-wrapper">
                  {viewingImage.processed_path ? (
                    <img src={getImageUrl(viewingImage.id, true, viewingImage._timestamp)} alt="Processed" />
                  ) : (
                    <div className="modal-unprocessed-box">
                      <Cpu size={40} />
                      <p>Image not yet processed with OpenCV</p>
                      <button
                        className="primary-btn inline-btn"
                        onClick={() => handleProcessImage(viewingImage.id)}
                        disabled={processingId === viewingImage.id}
                      >
                        {processingId === viewingImage.id ? 'Processing...' : 'Run OpenCV Preprocessing Now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Persistent AI Analysis Details within Modal */}
            {viewingImage.latest_analysis ? (
              <div className="ai-result-card" style={{ marginTop: 20 }}>
                <div className="ai-result-header">
                  <div className="ai-result-title-group">
                    <Sparkles size={18} className="ai-icon-sparkle" />
                    <h4>Persistent AI Soil Classification</h4>
                  </div>
                  <span className="ai-model-tag">
                    {viewingImage.latest_analysis.model_name} • ID #{viewingImage.latest_analysis.id}
                  </span>
                </div>

                <div className="ai-prediction-hero">
                  <div className="ai-soil-name-box">
                    <span className="ai-soil-label">{t('predicted_soil')}</span>
                    <span className="ai-soil-pred-name">
                      {language === 'gu' && viewingImage.latest_analysis.soil_info?.name_gu
                        ? viewingImage.latest_analysis.soil_info.name_gu
                        : viewingImage.latest_analysis.predicted_soil_name || viewingImage.latest_analysis.predicted_soil_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div
                    className={`ai-confidence-pill ${
                      viewingImage.latest_analysis.confidence >= 70
                        ? 'high'
                        : viewingImage.latest_analysis.confidence >= 50
                        ? 'medium'
                        : 'low'
                    }`}
                  >
                    <Brain size={16} />
                    <span>{viewingImage.latest_analysis.confidence}% {t('confidence')}</span>
                  </div>
                </div>

                {viewingImage.latest_analysis.soil_info && (
                  <div className="ai-soil-details-grid">
                    <div className="ai-detail-item">
                      <strong>{t('characteristics')}</strong>
                      <p>{viewingImage.latest_analysis.soil_info.characteristics}</p>
                    </div>
                    <div className="ai-detail-item">
                      <strong>{t('suitable_crops')}</strong>
                      <p>{viewingImage.latest_analysis.soil_info.typical_crops}</p>
                    </div>
                  </div>
                )}

                {/* All 7 classes probability breakdown */}
                {viewingImage.latest_analysis.probabilities && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      {t('probability_breakdown')} (7 Classes)
                    </div>
                    <div className="ai-probabilities-list">
                      {Object.entries(viewingImage.latest_analysis.probabilities).map(([clsName, probVal]) => {
                        const isWinner = clsName === viewingImage.latest_analysis.predicted_soil_type;
                        return (
                          <div key={clsName} className="prob-row">
                            <span className={`prob-label ${isWinner ? 'highlight' : ''}`}>{clsName.replace('_', ' ')}</span>
                            <div className="prob-track">
                              <div
                                className={`prob-fill ${isWinner ? 'winner' : ''}`}
                                style={{ width: `${Math.min(100, Math.max(0, probVal))}%` }}
                              />
                            </div>
                            <span className={`prob-value ${isWinner ? 'highlight' : ''}`}>{probVal}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="ai-disclaimer-box" style={{ marginTop: 14 }}>
                  <Info size={16} />
                  <div>
                    <strong>{t('ml_disclaimer_title')}: </strong>
                    {viewingImage.latest_analysis.disclaimer}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="primary-btn inline-btn"
                  onClick={() => handleClassifyStoredImage(viewingImage)}
                  disabled={galleryClassifyingId === viewingImage.id}
                >
                  <Sparkles size={16} /> Analyze with MobileNetV3 AI Classifier
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SoilImageUpload;
