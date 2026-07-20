const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '')
const renderApiHost = import.meta.env.VITE_API_HOST?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')

export const API_URL = configuredApiUrl || (
  renderApiHost ? `https://${renderApiHost}` : 'http://localhost:8000'
)

export const WS_URL = import.meta.env.VITE_WS_URL?.trim() || (
  `${API_URL.replace(/^http/, 'ws')}/ws`
)
