import { Link } from 'react-router-dom'
import { Wallet, PlusCircle, Users, CheckCircle2 } from 'lucide-react'
import logo from '../assets/logo.png'
import heroImg from '../assets/hero-illustration.png'
import './Landing.css'

function SplitPayLogo() {
  return (
    <span className="brand-wrap">
      <img src={logo} alt="SplitPay Logo" className="logo-img" />
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
        <div className="hero-bg-blobs">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
        </div>
        <div className="page-container hero-content">
          <div className="hero-text centered">
            <span className="eyebrow-badge">Powered by Stellar Soroban</span>
            <h1 className="hero-title">
              Split Bills <span className="gradient-text">Instantly</span>.
              <br />
              No Trust Required.
            </h1>
            <p className="hero-subtitle">
              SplitPay automates group expenses using secure smart contracts. 
              Real-time XLM payments with verifiable on-chain settlement.
            </p>
            <div className="hero-ctas">
              <Link to="/app" className="cta-primary">Launch App →</Link>
              <a href="#how-it-works" className="cta-secondary">Explore Features</a>
            </div>

            <div className="hero-illustration-wrap">
              <img src={heroImg} alt="SplitPay Dashboard Illustration" className="hero-main-img" />
            </div>

            <div className="trust-badges centered">
              <div className="badge"><span>⚡</span> Fast</div>
              <div className="badge"><span>🔒</span> Secure</div>
              <div className="badge"><span>💎</span> Zero-Fee</div>
            </div>
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
