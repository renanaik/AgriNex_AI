import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, SwitchCamera, RotateCcw, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function CameraCapture({ onPhotoSelected, onClose }) {
  const { t } = useLanguage();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // Default to rear camera
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Stop all media tracks safely
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping stream track:', e);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracks();
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
    };
  }, [stopTracks, capturedPreview]);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
    } catch (e) {
      console.warn('Could not enumerate video devices:', e);
    }
  }, []);

  // Start camera stream with given deviceId or facingMode
  const startCamera = useCallback(
    async (deviceId = null, mode = null) => {
      stopTracks();
      setLoading(true);
      setError(null);

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('camera_not_supported') || 'Camera access is not supported by your browser.');
        setLoading(false);
        return;
      }

      const activeMode = mode !== null ? mode : facingMode;
      const activeDeviceId = deviceId !== null ? deviceId : currentDeviceId;

      // Construct constraints with fallbacks
      let constraints;
      if (activeDeviceId) {
        constraints = {
          video: {
            deviceId: { exact: activeDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };
      } else {
        constraints = {
          video: {
            facingMode: { ideal: activeMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };
      }

      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr) {
          // If ideal/exact constraints failed, attempt basic video constraints
          console.warn('Initial camera constraints failed, retrying with fallback:', firstErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play was interrupted or auto-play blocked:', playErr);
          }
        }

        // Query active device information
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
          if (settings.deviceId && !activeDeviceId) {
            setCurrentDeviceId(settings.deviceId);
          }
        }

        await refreshDevices();
        setLoading(false);
      } catch (err) {
        console.error('Camera access error:', err);
        stopTracks();
        setLoading(false);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(
            t('camera_permission_denied') ||
              'Camera permission was denied. Please allow camera access in your browser settings.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError(t('camera_not_found') || 'No camera device found on this system.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError(t('camera_in_use') || 'Camera is in use by another application or blocked.');
        } else {
          setError(err.message || 'Unable to access camera.');
        }
      }
    },
    [stopTracks, facingMode, currentDeviceId, refreshDevices, t]
  );

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Switch between front and rear cameras (or cycle available video devices)
  const handleSwitchCamera = () => {
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      setCurrentDeviceId(nextDevice.deviceId);
      startCamera(nextDevice.deviceId, facingMode);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      setCurrentDeviceId('');
      startCamera(null, nextFacing);
    }
  };

  // Change camera via select dropdown
  const handleDeviceSelect = (e) => {
    const devId = e.target.value;
    setCurrentDeviceId(devId);
    startCamera(devId, facingMode);
  };

  // Capture frame to high-resolution JPEG
  const handleCapturePhoto = () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      // If front-facing camera, mirror horizontally for natural feel
      if (facingMode === 'user' && !currentDeviceId) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          setIsCapturing(false);
          if (!blob) {
            setError('Failed to capture frame from camera.');
            return;
          }

          // Create standard File object
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
            now.getHours()
          )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const filename = `soil_capture_${timestamp}.jpg`;
          const file = new File([blob], filename, { type: 'image/jpeg' });

          const preview = URL.createObjectURL(blob);
          setCapturedBlob({ blob, file });
          setCapturedPreview(preview);

          // Stop live tracks while reviewing captured image
          stopTracks();
        },
        'image/jpeg',
        0.95
      );
    } catch (e) {
      console.error('Capture photo error:', e);
      setIsCapturing(false);
      setError('An error occurred during photo capture.');
    }
  };

  // Retake photo: discard captured preview and restart camera
  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera(currentDeviceId, facingMode);
  };

  // Accept and use photo: send File object to parent component
  const handleUsePhoto = () => {
    if (capturedBlob?.file) {
      onPhotoSelected(capturedBlob.file);
    }
  };

  return (
    <div className="camera-capture-container">
      {/* Top Action Header */}
      <div className="camera-header-bar">
        <div className="camera-header-title">
          <Camera size={18} className="camera-active-icon" />
          <span>{capturedPreview ? t('captured_preview') : t('camera_preview')}</span>
        </div>

        <div className="camera-header-controls">
          {!capturedPreview && videoDevices.length > 1 && (
            <div className="camera-selector-wrap">
              <select
                className="camera-device-select"
                value={currentDeviceId}
                onChange={handleDeviceSelect}
                title={t('choose_camera')}
              >
                {videoDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!capturedPreview && (
            <button
              type="button"
              className="camera-icon-btn"
              onClick={handleSwitchCamera}
              title={t('switch_camera')}
              disabled={loading}
            >
              <SwitchCamera size={18} />
            </button>
          )}

          <button
            type="button"
            className="camera-icon-btn close-btn"
            onClick={() => {
              stopTracks();
              if (onClose) onClose();
            }}
            title={t('close_camera')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Viewport Area */}
      <div className="camera-viewport-card">
        {error ? (
          <div className="camera-error-state">
            <AlertCircle size={44} className="camera-error-icon" />
            <h4>Camera Unavailable</h4>
            <p className="camera-error-msg">{error}</p>
            <div className="camera-error-actions">
              <button
                type="button"
                className="primary-btn inline-btn"
                onClick={() => startCamera(currentDeviceId, facingMode)}
              >
                <RefreshCw size={15} /> Retry Camera
              </button>
              <button
                type="button"
                className="secondary-btn inline-btn"
                onClick={() => {
                  stopTracks();
                  if (onClose) onClose();
                }}
              >
                Switch to File Upload
              </button>
            </div>
          </div>
        ) : capturedPreview ? (
          /* Captured Preview Mode */
          <div className="captured-preview-wrapper">
            <img src={capturedPreview} alt="Captured Soil" className="captured-preview-img" />
            <div className="captured-meta-badge">
              <span>
                {capturedBlob?.file?.name} •{' '}
                {capturedBlob?.blob ? (capturedBlob.blob.size / (1024 * 1024)).toFixed(2) : '0'} MB
              </span>
            </div>
          </div>
        ) : (
          /* Live Stream Mode */
          <div className="live-stream-wrapper">
            {loading && (
              <div className="camera-loading-overlay">
                <div className="spinner"></div>
                <p>Initializing camera...</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`camera-video-element ${facingMode === 'user' && !currentDeviceId ? 'mirrored' : ''}`}
            />

            {/* Viewfinder Reticle & Guides for Farmer */}
            <div className="camera-viewfinder-overlay">
              <div className="reticle-corner corner-tl"></div>
              <div className="reticle-corner corner-tr"></div>
              <div className="reticle-corner corner-bl"></div>
              <div className="reticle-corner corner-br"></div>
              <span className="reticle-hint">{t('align_soil_sample')}</span>
            </div>

            <div className="live-indicator-badge">
              <span className="live-dot"></span> LIVE
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="camera-footer-bar">
        {capturedPreview ? (
          <div className="captured-action-buttons">
            <button
              type="button"
              className="secondary-btn retake-btn"
              onClick={handleRetake}
            >
              <RotateCcw size={16} /> {t('retake')}
            </button>
            <button
              type="button"
              className="primary-btn use-photo-btn"
              onClick={handleUsePhoto}
            >
              <Check size={16} /> {t('use_photo')}
            </button>
          </div>
        ) : (
          <div className="live-capture-actions">
            <button
              type="button"
              className="shutter-capture-btn"
              onClick={handleCapturePhoto}
              disabled={loading || !!error || isCapturing}
              title={t('capture_photo')}
            >
              <div className="shutter-inner-circle">
                <Camera size={26} />
              </div>
            </button>
            <span className="shutter-label">
              {isCapturing ? t('capturing') : t('capture_photo')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
