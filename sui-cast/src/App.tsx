// src/App.tsx
import WalletSessionManager from './WalletSessionManager';
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit';
import LoginPage from './pages/LoginPage';
import DocumentsPage from './pages/DocumentsPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }: { children: any }) {
  const account = useCurrentAccount();
  const zkLoginAddress = sessionStorage.getItem('zklogin_address');
  const location = useLocation();

  // Check if user is authenticated (Wallet or zkLogin)
  const isAuthenticated = !!account || !!zkLoginAddress;

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) return savedTheme;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <>
      <WalletSessionManager />
  
      <Routes>
        <Route path="/" element={<LoginPage theme={theme} setTheme={setTheme} />} />
        <Route 
          path="/app" 
          element={
            <ProtectedRoute>
              <DocumentsPage theme={theme} setTheme={setTheme} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:address?" 
          element={
            <ProtectedRoute>
              <ProfilePage theme={theme} setTheme={setTheme} />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
  
}

export default App;
