import { useState } from 'react'
import { CircleCheckBig, Wallet } from 'lucide-react'
import { isConnected, requestAccess, getPublicKey } from '@stellar/freighter-api'
import logo from '../assets/logo.png'
import './WalletConnectionPage.css'

function SplitPayLogo() {
  return (
    <span className="wc-brand-wrap">
      <img src={logo} alt="SplitPay Logo" className="wc-logo-img" />
      <span className="wc-logo-text">SplitPay</span>
    </span>
  )
}

function shortAddress(address) {
  if (!address || address.length !== 56 || !address.startsWith('G')) return 'Not connected'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// Helper: extract a public key string from any response shape
// v2.0.0 returns a raw string, newer versions return { address } or { publicKey }
function extractKey(result) {
  if (typeof result === 'string' && result.length === 56 && result.startsWith('G')) {
    return result
  }
  if (result && typeof result === 'object') {
    const candidate = result.address || result.publicKey || ''
    if (typeof candidate === 'string' && candidate.length === 56 && candidate.startsWith('G')) {
      return candidate
    }
  }
  return null
}

// Helper: extract boolean from isConnected result
// v2.0.0 returns boolean or window.freighter object, newer versions return { isConnected }
function extractConnected(result) {
  if (typeof result === 'boolean') return result
  if (result && typeof result === 'object') {
    if ('isConnected' in result) return Boolean(result.isConnected)
    // window.freighter object is truthy = connected
    return true
  }
  return false
}

function WalletConnectionPage({ onConnected }) {
  const [status, setStatus] = useState('default')
  const [publicKey, setPublicKey] = useState('')
  const [errorDetail, setErrorDetail] = useState('')

  const continueToDashboard = () => {
    if (!publicKey || publicKey.length !== 56 || !publicKey.startsWith('G')) {
      setStatus('error')
      setErrorDetail('Invalid wallet address')
      return
    }
    onConnected(publicKey)
  }

  const connectWallet = async () => {
    setStatus('loading')
    setErrorDetail('')
    console.log('[SplitPay] Connecting to Freighter...')
    try {
      // Step 1: Check if Freighter extension is installed
      const connResult = await isConnected()
      console.log('[SplitPay] isConnected result:', connResult, typeof connResult)
      const connected = extractConnected(connResult)
      if (!connected) {
        throw new Error('Freighter extension not detected. Make sure it is installed and enabled.')
      }

      // Step 2: Request access (prompts user to approve this site)
      let key = null
      try {
        const accessResult = await requestAccess()
        console.log('[SplitPay] requestAccess result:', accessResult, typeof accessResult)
        key = extractKey(accessResult)
      } catch (accessErr) {
        console.warn('[SplitPay] requestAccess threw, trying getPublicKey...', accessErr)
      }

      // Step 3: Fallback to getPublicKey if requestAccess didn't yield a key
      if (!key) {
        const pkResult = await getPublicKey()
        console.log('[SplitPay] getPublicKey result:', pkResult, typeof pkResult)
        key = extractKey(pkResult)
      }

      if (!key) {
        throw new Error('No valid public key returned. Please unlock Freighter and approve this site.')
      }

      console.log('[SplitPay] Connected with key:', key)
      setPublicKey(key)
      setStatus('success')
    } catch (error) {
      console.error('[SplitPay] Wallet connection error:', error)
      setErrorDetail(error.message || 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div className="wallet-page">
      <nav className="wc-navbar">
        <a href="/" className="wc-nav-brand" aria-label="SplitPay Home">
          <SplitPayLogo />
        </a>

        <div className="wc-nav-links">
          <a href="/#how-it-works" className="wc-nav-link">How it Works</a>
          <a href="/#features" className="wc-nav-link">Features</a>
          <a href="https://soroban.stellar.org/docs" target="_blank" rel="noreferrer" className="wc-nav-link">Docs</a>
        </div>

        <button type="button" className="wc-nav-cta active" aria-current="page">
          Connect Wallet
        </button>
      </nav>

      <main className="wc-main">
        <div className="wc-content">
          <Wallet size={48} className="wc-top-icon" />
          <h1>Connect Your Wallet</h1>
          <p className="wc-subtitle">
            Connect your Stellar wallet to start splitting bills with friends on-chain.
          </p>

          {status === 'error' && (
            <div className="wc-alert">
              {errorDetail || 'Could not connect to Freighter.'}{' '}
              <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Download Freighter</a>
            </div>
          )}

          <span className="wc-state-label">
            {status === 'default' && 'DEFAULT'}
            {status === 'loading' && 'LOADING'}
            {status === 'success' && 'SUCCESS'}
            {status === 'error' && 'ERROR'}
          </span>

          {status === 'success' && publicKey && publicKey.length === 56 && publicKey.startsWith('G') ? (
            <section className="wc-success-card">
              <CircleCheckBig size={34} />
              <h2>Connected!</h2>
              <span className="wc-address-pill">{shortAddress(publicKey)}</span>
              <button type="button" className="wc-continue-btn" onClick={continueToDashboard}>
                Continue to Dashboard →
              </button>
            </section>
          ) : (
            <section className="wc-wallet-card">
              <div className="wc-wallet-left">
                <span className="wc-freighter-logo">F</span>
                <div>
                  <h2>Freighter Wallet</h2>
                  <p>Official Stellar browser extension</p>
                </div>
              </div>
              <button
                type="button"
                className="wc-connect-btn"
                disabled={status === 'loading'}
                onClick={connectWallet}
              >
                {status === 'loading' ? (
                  <>
                    <span className="wc-spinner" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </section>
          )}

          <div className="wc-trust-items">
            <span>🔐 Non-custodial</span>
            <span aria-hidden="true">·</span>
            <span>🌐 Testnet &amp; Mainnet</span>
            <span aria-hidden="true">·</span>
            <span>⚡ Instant sign</span>
          </div>

          <p className="wc-bottom-note">
            We never access or store your private key.{' '}
            <a href="https://soroban.stellar.org/docs" target="_blank" rel="noreferrer">Read our security model →</a>
          </p>
        </div>
      </main>
    </div>
  )
}

export default WalletConnectionPage
