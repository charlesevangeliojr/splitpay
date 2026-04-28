import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import WalletConnectionPage from './pages/WalletConnectionPage'
import Dashboard from './pages/Dashboard'
import { api } from './lib/api'

function AppDashboard() {
  const [publicKey, setPublicKey] = useState(() => {
    const saved = localStorage.getItem('splitpay_public_key')
    // Reject mock or invalid wallet addresses
    if (saved && saved.startsWith('G') && saved.length === 56 && !saved.includes('MOCK')) {
      return saved
    }
    localStorage.removeItem('splitpay_public_key')
    return null
  })

  useEffect(() => {
    if (publicKey) {
      localStorage.setItem('splitpay_public_key', publicKey)
      api.connectWallet(publicKey).catch((error) => {
        console.error('Failed to sync wallet session:', error)
      })
    } else {
      localStorage.removeItem('splitpay_public_key')
    }
  }, [publicKey])

  const handleDisconnect = async () => {
    if (publicKey) {
      try {
        await api.disconnectWallet(publicKey)
      } catch (error) {
        console.error('Failed to disconnect backend session:', error)
      }
    }
    setPublicKey(null)
  }

  return (
    <>
      {publicKey ? (
        <Dashboard publicKey={publicKey} onDisconnect={handleDisconnect} />
      ) : (
        <WalletConnectionPage onConnected={setPublicKey} />
      )}
    </>
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
