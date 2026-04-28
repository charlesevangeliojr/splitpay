import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
          <span className="logo-text">SplitPay</span>
        </div>
        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">How it Works</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="https://github.com/charlesevangeliojr/splitpay" target="_blank" rel="noopener noreferrer" className="nav-link">Docs</a>
        </div>
        <Link to="/app" className="nav-cta">Connect Wallet</Link>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow-badge">Built on Stellar Soroban</span>
          <h1 className="hero-title">
            Split Bills Instantly.
            <br />
            No Awkward Reminders.
          </h1>
          <p className="hero-subtitle">
            SplitPay automates group expenses using smart contracts — 
            instant XLM payments, transparent tracking, zero trust required.
          </p>
          <div className="hero-ctas">
            <Link to="/app" className="cta-primary">
              Get Started — Connect Wallet
            </Link>
            <a href="#how-it-works" className="cta-secondary">
              See How It Works
            </a>
          </div>
          <div className="trust-badges">
            <span className="badge">⚡ Instant Payments</span>
            <span className="badge-separator">·</span>
            <span className="badge">🔒 On-chain Tracking</span>
            <span className="badge-separator">·</span>
            <span className="badge">💸 Near-zero Fees</span>
          </div>
        </div>
        
        {/* Decorative gradient orb */}
        <div className="gradient-orb"></div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="section-container">
          <h2 className="section-title">How SplitPay Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 11L11 14L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="step-title">Connect Wallet</h3>
              <p className="step-description">
                Link your Freighter wallet securely. 
                No sign-ups, no passwords needed.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="step-title">Create a Split</h3>
              <p className="step-description">
                Enter total amount and add participants. 
                Smart contract calculates equal shares.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="step-title">Friends Pay Their Share</h3>
              <p className="step-description">
                Participants click pay to send XLM instantly. 
                No more chasing for money.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="step-title">Auto-Settled On-Chain</h3>
              <p className="step-description">
                When all pay, split automatically settles. 
                Transparent, permanent, trustless.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-container">
          <h2 className="section-title">Why SplitPay?</h2>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-emoji">⚡</span>
              <h4>Lightning Fast</h4>
              <p>Payments settle in 5 seconds on Stellar</p>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">🔒</span>
              <h4>Secure & Transparent</h4>
              <p>Every transaction recorded on-chain</p>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">💸</span>
              <h4>Near-Zero Fees</h4>
              <p>Fractions of a cent per transaction</p>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">🌐</span>
              <h4>Global Access</h4>
              <p>Anyone with a Stellar wallet can use it</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <h2 className="cta-title">Ready to split bills without the awkwardness?</h2>
          <p className="cta-subtitle">Join thousands using SplitPay for instant, trustless group payments.</p>
          <Link to="/app" className="cta-primary large">
            Launch App — It's Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
            <span className="logo-text">SplitPay</span>
          </div>
          <div className="footer-links">
            <a href="https://github.com/charlesevangeliojr/splitpay" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://soroban.stellar.org/docs" target="_blank" rel="noopener noreferrer">Stellar Docs</a>
            <a href="https://stellar.expert/explorer/testnet/contract/CC2F6Y6QJ4FHB5QXZDJ4YEA7F3MU2CHZB7YOMSX6B646Q4SQOCTRSSDO" target="_blank" rel="noopener noreferrer">Contract</a>
          </div>
          <p className="footer-license">MIT License — Copyright © 2026 SplitPay Contributors</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
