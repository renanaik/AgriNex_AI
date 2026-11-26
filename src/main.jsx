import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#ffffff',
                color: '#26352b',
                border: '1px solid #e8eee8',
                borderRadius: '8px',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              },
              success: {
                iconTheme: {
                  primary: '#267344',
                  secondary: '#ffffff',
                },
              },
            }}
          />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
