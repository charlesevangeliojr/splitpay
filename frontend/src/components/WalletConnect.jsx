import { useEffect, useState } from 'react'
import { isConnected, getPublicKey } from '@stellar/freighter-api'
import './WalletConnect.css'

function WalletConnect({ publicKey, setPublicKey }) {
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const connected = await isConnected()
      if (connected) {
        const key = await getPublicKey()
        setPublicKey(key)
      }
    } catch (err) {
      setIsFreighterInstalled(false)
    }
  }

  const connectWallet = async () => {
    try {
      const key = await getPublicKey()
      setPublicKey(key)
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
