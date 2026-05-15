import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import AlertHistory from './pages/AlertHistory'

export default function App() {
  const [connected, setConnected] = useState(false)

  const handleConnectionChange = useCallback((status) => {
    setConnected(status)
  }, [])

  return (
    <BrowserRouter>
      <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'monospace' }}>
        <Navbar connected={connected} />
        <Routes>
          <Route path="/"        element={<Dashboard onConnectionChange={handleConnectionChange} />} />
          <Route path="/history" element={<AlertHistory />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
