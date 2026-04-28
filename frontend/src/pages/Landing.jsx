import { Link } from 'react-router-dom'
import { Wallet, PlusCircle, Users, CheckCircle2 } from 'lucide-react'
import './Landing.css'

function SplitPayLogo() {
  return (
    <span className="brand-wrap">
      <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.2" />
        <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
      <span className="logo-text">SplitPay</span>
    </span>
  )
}

const steps = [
  {
    number: '1',
    title: 'Connect Wallet',
    description: 'Link your Stellar wallet in one click to authenticate securely.',
    icon: Wallet
  },
  {
    number: '2',
    title: 'Create a Split',
    description: 'Set the amount and participants, then deploy split terms on-chain.',
    icon: PlusCircle
  },
  {
    number: '3',
    title: 'Friends Pay Their Share',
    description: 'Participants send XLM instantly with transparent status updates.',
    icon: Users
  },
  {
    number: '4',
    title: 'Auto-Settled On-Chain',
    description: 'Soroban contracts finalize settlement automatically and verifiably.',
    icon: CheckCircle2
  }
]

function Landing() {
  return (
    <div className="landing">
      <nav className="navbar">
        <a href="#" className="nav-brand" aria-label="SplitPay Home">
          <SplitPayLogo />
        </a>

        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">How it Works</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="https://soroban.stellar.org/docs" target="_blank" rel="noreferrer" className="nav-link">Docs</a>
        </div>

        <Link to="/app" className="nav-cta">Connect Wallet</Link>
      </nav>

      <section className="hero">
        <div className="page-container hero-content">
          <span className="eyebrow-badge">Built on Stellar Soroban</span>
          <h1 className="hero-title">
            Split Bills Instantly.
            <br />
            No Awkward Reminders.
          </h1>
          <p className="hero-subtitle">
            SplitPay automates group expenses using smart contracts — instant XLM payments, transparent tracking,
            zero trust required.
          </p>
          <div className="hero-ctas">
            <Link to="/app" className="cta-primary">Get Started — Connect Wallet</Link>
            <a href="#how-it-works" className="cta-secondary">See How It Works</a>
          </div>
          <div id="features" className="trust-badges">
            <span>⚡ Instant Payments</span>
            <span aria-hidden="true">·</span>
            <span>🔒 On-chain Tracking</span>
            <span aria-hidden="true">·</span>
            <span>💸 Near-zero Fees</span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="page-container">
          <h2 className="section-title">How SplitPay Works</h2>
          <div className="steps-row">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <article key={step.number} className="step-card">
                  <div className="step-number">{step.number}</div>
                  <div className="step-icon">
                    <Icon size={24} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="page-container footer-inner">
          <SplitPayLogo />
          <div className="footer-links">
            <a href="https://github.com/charlesevangeliojr/splitpay" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://soroban.stellar.org/docs" target="_blank" rel="noreferrer">Stellar Docs</a>
            <span className="license">MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
