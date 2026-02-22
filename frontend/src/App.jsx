import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import UnitDetailPage from './pages/UnitDetailPage'
import AnomaliesPage from './pages/AnomaliesPage'
import SankeyPage from './pages/SankeyPage'
import SettingsPage from './pages/SettingsPage'
import UploadPage from './pages/UploadPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="unit/:code" element={<UnitDetailPage />} />
          <Route path="anomalies" element={<AnomaliesPage />} />
          <Route path="sankey" element={<SankeyPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="upload" element={<UploadPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
