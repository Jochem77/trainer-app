import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import './index.css'

// basename moet overeenkomen met Vite base
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      errorElement: <ErrorBoundary message="Er ging iets mis met laden van de pagina." />
    },
    {
      path: '*',
      element: <NotFound />
    }
  ],
  { basename: '/trainer-app/' }   // <— repo-naam
)

function NotFound() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h3>Pagina niet gevonden</h3>
      <p>Ga terug naar de <a href="/trainer-app/">homepagina</a>.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
