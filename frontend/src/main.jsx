import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sensors from './pages/Sensors';
import History from './pages/History';
import Anomalies from './pages/Anomalies';
import DailySummary from './pages/DailySummary';
import Forecast from './pages/Forecast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { queryClient } from './lib/queryClient';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="capteurs" element={<Sensors />} />
              <Route path="historique" element={<History />} />
              <Route path="anomalies" element={<Anomalies />} />
              <Route path="resume" element={<DailySummary />} />
              <Route path="prevision" element={<Forecast />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
