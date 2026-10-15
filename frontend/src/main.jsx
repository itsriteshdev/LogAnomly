import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '10px',
            background: '#0f2040',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '13px',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
