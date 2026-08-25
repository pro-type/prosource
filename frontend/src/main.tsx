import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1E293B',
              color: '#F1F5F9',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '10px',
              fontSize: '14px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#F1F5F9' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#F1F5F9' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
