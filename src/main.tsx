import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import './index.css'

function NotFound() {
  // Als iemand op een subroute landt, toon gewoon de app of link naar home
  return (
    <div style={{padding:24,fontFamily:'system-ui'}}>
      <h3>Pagina niet gevonden</h3>
      <p>Ga terug naar de <a href="/trainer-app/">home</a>.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/trainer-app/">
      <Routes>
        <Route path="/" element={<App />} />
        {/* Fallback: elk onbekend pad -> App (of <NotFound /> als je wilt) */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
