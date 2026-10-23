import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Sensors from './pages/Sensors'
import History from './pages/History'
import Anomalies from './pages/Anomalies'
import DailySummary from './pages/DailySummary'
import Forecast from './pages/Forecast'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="capteurs" element={<Sensors />} />
          <Route path="historique" element={<History />} />
          <Route path="anomalies" element={<Anomalies />} />
          <Route path="resume" element={<DailySummary />} />
          <Route path="prevision" element={<Forecast />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
