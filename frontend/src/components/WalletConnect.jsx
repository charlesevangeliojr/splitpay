import { useEffect, useState } from 'react'
import { isConnected, requestAccess, getPublicKey } from '@stellar/freighter-api'
import './WalletConnect.css'

// v2.0.0 returns raw values; newer versions return objects. Handle both.
function extractKey(result) {
  if (typeof result === 'string' && result.length === 56 && result.startsWith('G')) return result
  if (result && typeof result === 'object') {
    const c = result.address || result.publicKey || ''
    if (typeof c === 'string' && c.length === 56 && c.startsWith('G')) return c
  }
  return null
}
function extractConnected(result) {
  if (typeof result === 'boolean') return result
  if (result && typeof result === 'object') {
    if ('isConnected' in result) return Boolean(result.isConnected)
    return true
  }
  return false
}

function WalletConnect({ publicKey, setPublicKey }) {
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const connResult = await isConnected()
      if (extractConnected(connResult)) {
        let key = extractKey(await requestAccess().catch(() => null))
        if (!key) key = extractKey(await getPublicKey().catch(() => null))
        if (key) setPublicKey(key)
      }
    } catch (err) {
      setIsFreighterInstalled(false)
    }
  }

  const connectWallet = async () => {
    try {
      const connResult = await isConnected()
      if (!extractConnected(connResult)) {
        setIsFreighterInstalled(false)
        return
      }
      let key = extractKey(await requestAccess().catch(() => null))
      if (!key) key = extractKey(await getPublicKey().catch(() => null))
      if (key) {
        setPublicKey(key)
      } else {
        alert('Could not get public key. Please unlock Freighter and approve this site.')
      }
    } catch (err) {
      alert('Please install Freighter wallet extension')
    }
  }

  const disconnectWallet = () => {
    setPublicKey(null)
  }

  if (!isFreighterInstalled) {
    return (
      <a 
        href="https://www.freighter.app/" 
        target="_blank" 
        rel="noopener noreferrer"
        className="install-btn"
      >
        Install Freighter Wallet
      </a>
    )
  }

  return (
    <div className="wallet-connect">
      {publicKey ? (
        <div className="wallet-info">
          <span className="wallet-address">
            {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
          </span>
          <button onClick={disconnectWallet} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={connectWallet} className="connect-btn">
          Connect Freighter Wallet
        </button>
      )}
    </div>
  )
}

export default WalletConnect
