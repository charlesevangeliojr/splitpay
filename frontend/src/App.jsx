import { useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import WalletConnect from './components/WalletConnect'
import CreateSplit from './components/CreateSplit'
import ViewSplit from './components/ViewSplit'
import './App.css'

function AppDashboard() {
  const [publicKey, setPublicKey] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>💸 SplitPay</h1>
        <p>Split bills instantly with friends</p>
        <WalletConnect publicKey={publicKey} setPublicKey={setPublicKey} />
      </header>

      {publicKey ? (
        <main className="app-main">
          <nav className="nav-links">
            <NavLink 
              to="/app/create" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              Create Split
            </NavLink>
            <NavLink 
              to="/app/view" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              View Split
            </NavLink>
          </nav>

          <Routes>
            <Route path="/" element={<Navigate to="/app/create" replace />} />
            <Route path="/create" element={<CreateSplit publicKey={publicKey} />} />
            <Route path="/view" element={<ViewSplit publicKey={publicKey} />} />
          </Routes>
        </main>
      ) : (
        <div className="connect-prompt">
          <p>Please connect your wallet to use SplitPay</p>
        </div>
      )}

      <footer className="app-footer">
        <p>Built on Stellar Soroban</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app/*" element={<AppDashboard />} />
    </Routes>
  )
}

export default App
