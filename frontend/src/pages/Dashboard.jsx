import { useEffect, useMemo, useState } from 'react'
import { Horizon } from '@stellar/stellar-sdk'
import logo from '../assets/logo.png'
import {
  Activity,
  CheckCircle2,
  Copy,
  CirclePlus,
  ClipboardList,
  House,
  LogOut,
  RefreshCw,
  Settings,
  SquareChartGantt,
  Unlink,
  Wallet,
  X
} from 'lucide-react'
import './Dashboard.css'
import { api } from '../lib/api'

function truncateAddress(address) {
  if (!address) return 'GXXX...XXXX'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function isValidStellarAddress(address) {
  return /^G[A-Z2-7]{55}$/.test(address)
}

function SkeletonCard() {
  return (
    <div className="stat-card skeleton-card">
      <div className="skeleton skeleton-icon" />
      <div className="skeleton skeleton-h3" />
      <div className="skeleton skeleton-p" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array(7).fill(0).map((_, i) => (
        <td key={i}><div className="skeleton skeleton-td" /></td>
      ))}
    </tr>
  )
}

function Dashboard({ publicKey, onDisconnect }) {
  const [activeView, setActiveView] = useState('dashboard')
  const [splitLabel, setSplitLabel] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [tokenContract, setTokenContract] = useState('XLM (Native)')
  const [participantInput, setParticipantInput] = useState('')
  const [participants, setParticipants] = useState([])
  const [participantError, setParticipantError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isCurrentUserPaid, setIsCurrentUserPaid] = useState(false)
  const [paymentState, setPaymentState] = useState('default')
  const [activityFilter, setActivityFilter] = useState('All')
  const [activeNetwork, setActiveNetwork] = useState('Testnet')
  const [currency, setCurrency] = useState('XLM')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [notifyPaymentReceived, setNotifyPaymentReceived] = useState(true)
  const [notifySplitSettled, setNotifySplitSettled] = useState(true)
  const [notifyPaymentReminder, setNotifyPaymentReminder] = useState(false)
  const [developerExpanded, setDeveloperExpanded] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [splits, setSplits] = useState([])
  const [activityRows, setActivityRows] = useState([])
  const [hasActivity, setHasActivity] = useState(true)
  const [apiError, setApiError] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [currentSplitId, setCurrentSplitId] = useState(null)
  const [toast, setToast] = useState(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [xlmBalance, setXlmBalance] = useState('0.00')

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const currentSplit = useMemo(() => {
    if (!currentSplitId) return null
    return splits.find(s => String(s.id).replace('#', '') === currentSplitId)
  }, [splits, currentSplitId])

  const parsedTotal = Number(totalAmount || 0)
  const canComputeSplit = participants.length > 0 && parsedTotal > 0
  const perPerson = canComputeSplit ? parsedTotal / participants.length : 0
  const isFormValid = splitLabel.trim() && canComputeSplit && perPerson >= 1
  const splitId = currentSplitId || '---'
  const truncatedTxHash = '...'
  const txHash = '...'

  const previewRows = useMemo(() => {
    if (!canComputeSplit) return []
    return participants.map((address) => ({
      address: truncateAddress(address),
      owes: `${perPerson.toFixed(2)} XLM`
    }))
  }, [canComputeSplit, participants, perPerson])

  const recentSplits = useMemo(
    () =>
      splits.slice(0, 5).map((split) => ({
        id: split.id,
        label: split.label,
        total: `${split.total_xlm.toFixed(2)} XLM`,
        perPerson: `${split.per_person_xlm.toFixed(2)} XLM`,
        participants: split.participants.length,
        status: split.status
      })),
    [splits]
  )

  const owes = useMemo(
    () =>
      splits
        .filter((split) => split.status !== 'SETTLED')
        .slice(0, 2)
        .map((split) => ({
          id: split.id,
          label: split.label,
          amount: `${split.per_person_xlm.toFixed(2)} XLM`,
          creator: truncateAddress(split.creator)
        })),
    [splits]
  )

  const loadBalance = async () => {
    try {
      const server = new Horizon.Server('https://horizon-testnet.stellar.org')
      const account = await server.loadAccount(publicKey)
      const balance = account.balances.find((b) => b.asset_type === 'native')
      if (balance) {
        setXlmBalance(parseFloat(balance.balance).toFixed(2))
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setXlmBalance('Unfunded')
      } else {
        console.warn('Could not load XLM balance:', error.message)
      }
    }
  }

  const loadData = async () => {
    try {
      loadBalance() // Parallel fetch
      const data = await api.getSplits()
      setSplits(Array.isArray(data) ? data : [])
    } catch (error) {
      console.warn('Could not load splits:', error.message)
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
    // Auto-refresh every 30s
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    api
      .getActivity(activityFilter.toLowerCase())
      .then((data) => {
        const rows = (Array.isArray(data) ? data : []).map((item) => {
          const typeMap = {
            created: { icon: '📤', iconClass: 'blue' },
            paid: { icon: '💸', iconClass: 'amber' },
            settled: { icon: '✅', iconClass: 'green' },
            received: { icon: '📥', iconClass: 'purple' }
          }
          const mappedType = typeMap[item.event_type] || typeMap.created
          return {
            ...mappedType,
            event: item.event,
            split: item.split,
            amount: `${Number(item.amount_xlm || 0).toFixed(2)} XLM`,
            participants: item.participants ? `${item.participants} people` : '—',
            status: item.status || '—',
            date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        })
        setActivityRows(rows)
        setHasActivity(rows.length > 0)
      })
      .catch((error) => {
        console.warn('Could not load activity:', error.message)
      })
  }, [activityFilter])

  useEffect(() => {
    if (!publicKey) return
    api
      .getSettings(publicKey)
      .then((settings) => {
        setActiveNetwork(settings.active_network || 'Testnet')
        setCurrency(settings.currency || 'XLM')
        setDateFormat(settings.date_format || 'MM/DD/YYYY')
        setNotifyPaymentReceived(Boolean(settings.notify_payment_received))
        setNotifySplitSettled(Boolean(settings.notify_split_settled))
        setNotifyPaymentReminder(Boolean(settings.notify_payment_reminder))
      })
      .catch((error) => {
        console.warn('Could not load settings:', error.message)
      })
  }, [publicKey])

  const addParticipant = () => {
    const trimmed = participantInput.trim().toUpperCase()
    if (!isValidStellarAddress(trimmed)) {
      setParticipantError('Invalid Stellar address format')
      return
    }
    if (participants.includes(trimmed)) {
      setParticipantError('Address already added')
      return
    }
    setParticipants((prev) => [...prev, trimmed])
    setParticipantInput('')
    setParticipantError('')
  }

  const removeParticipant = (address) => {
    setParticipants((prev) => prev.filter((item) => item !== address))
  }

  const handleParticipantInput = (event) => {
    setParticipantInput(event.target.value)
    if (participantError) setParticipantError('')
  }

  const createSplit = async () => {
    if (!isFormValid) return
    setApiError('')
    try {
      const split = await api.createSplit({
        label: splitLabel.trim(),
        creator: publicKey,
        total_xlm: parsedTotal,
        participants
      })
      showToast('Split created successfully!')
      setCurrentSplitId(String(split.id || '7').replace('#', ''))
      setSplits((prev) => [split, ...prev])
      setActiveView('created')
      loadBalance() // Immediate balance update
    } catch (error) {
      setApiError(error.message)
      showToast(error.message, 'error')
    }
  }

  const copySplitId = async () => {
    try {
      await navigator.clipboard.writeText(splitId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (_error) {
      setCopied(false)
    }
  }

  const copyTxHash = async () => {
    try {
      await navigator.clipboard.writeText(txHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (_error) {
      setCopied(false)
    }
  }

  const startPayment = async () => {
    setPaymentState('loading')
    try {
      await api.payShare(splitId, publicKey)
      showToast('Payment successful!')
      setIsCurrentUserPaid(true)
      setPaymentState('default')
      setActiveView('pay-success')
      loadData() // Refresh list and balance
    } catch (error) {
      setApiError(error.message)
      setPaymentState('error')
      showToast(error.message, 'error')
    }
  }

  const retryPayment = () => {
    setPaymentState('default')
  }

  const saveSettings = async (next) => {
    if (!publicKey) return
    setIsSavingSettings(true)
    try {
      await api.updateSettings(publicKey, {
        active_network: next.activeNetwork,
        currency: next.currency,
        date_format: next.dateFormat,
        notify_payment_received: next.notifyPaymentReceived,
        notify_split_settled: next.notifySplitSettled,
        notify_payment_reminder: next.notifyPaymentReminder
      })
    } catch (error) {
      setApiError(error.message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const stats = useMemo(() => {
    const totalSplits = splits.length
    const pendingPayments = splits.filter(s => s.status !== 'SETTLED').length
    const settledCount = splits.filter(s => s.status === 'SETTLED').length
    const totalXlmSent = splits.reduce((acc, s) => {
      const paid = s.participants.filter(p => p.paid).length
      return acc + (paid * s.per_person_xlm)
    }, 0)
    return { totalSplits, pendingPayments, settledCount, totalXlmSent }
  }, [splits])

  const paidCount = currentSplit ? currentSplit.participants.filter(p => p.paid).length : 0
  const isSettled = currentSplit ? currentSplit.status === 'SETTLED' : false
  const totalCollected = currentSplit ? paidCount * currentSplit.per_person_xlm : 0

  const pageTitle =
    activeView === 'create'
      ? 'Create Split'
      : activeView === 'created'
        ? 'Split Created'
        : activeView === 'pay'
          ? `Payment / Split #${splitId}`
          : activeView === 'pay-success'
            ? `Payment Success / Split #${splitId}`
            : activeView === 'activity'
              ? 'Activity'
              : activeView === 'settings'
                ? 'Settings'
                : activeView === 'detail'
                  ? `Splits / Split #${splitId}`
                  : 'Dashboard'

  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div>
          <div className="dashboard-brand">
            <div className="brand-icon-wrap">
              <img src={logo} alt="SplitPay Logo" className="dashboard-logo-img" />
            </div>
            <div className="brand-text-wrap">
              <span className="brand-name">SplitPay</span>
              <span className="brand-tagline">On-chain payments</span>
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              type="button"
              className={`dashboard-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <House size={16} />
              Dashboard
            </button>
            <button
              type="button"
              className={`dashboard-nav-item ${activeView === 'create' ? 'active' : ''}`}
              onClick={() => setActiveView('create')}
            >
              <CirclePlus size={16} />
              Create Split
            </button>
            <button
              type="button"
              className={`dashboard-nav-item ${activeView === 'created' ? 'active' : ''}`}
              onClick={() => setActiveView('created')}
            >
              <ClipboardList size={16} />
              My Splits
            </button>
            <button
              type="button"
              className={`dashboard-nav-item ${activeView === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveView('activity')}
            >
              <Activity size={16} />
              Activity
            </button>
            <button
              type="button"
              className={`dashboard-nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <Settings size={16} />
              Settings
            </button>
          </nav>
        </div>

        <div className="sidebar-wallet">
          <span className="wallet-pill">{truncateAddress(publicKey)}</span>
          <button type="button" className="disconnect-btn" onClick={onDisconnect} aria-label="Disconnect wallet">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="dashboard-main content-container">
        <header className="main-topbar">
          <h1>{pageTitle}</h1>
          <div className="topbar-right">
            <div className="balance-group">
              <button
                className="balance-chip"
                onClick={loadBalance}
                title="Refresh balance"
                type="button"
              >
                <RefreshCw size={12} className={isLoadingData ? 'spinning' : ''} />
                {xlmBalance === 'Unfunded' ? (
                  <a
                    href={`https://lab.stellar.org/#account-creator/create?network=testnet&publicKey=${publicKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="unfunded-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Fund Account
                  </a>
                ) : (
                  `${xlmBalance} XLM`
                )}
              </button>
            </div>
            <div className="network-chip">TESTNET</div>
            <div className="avatar">
              {publicKey?.substring(0, 2)}
            </div>
          </div>
        </header>

        {apiError && <div className="api-error-banner">{apiError}</div>}
        {isSavingSettings && <div className="api-info-banner">Saving settings...</div>}

        {activeView === 'dashboard' ? (
          <>
            <section className="stats-grid">
              {isLoadingData ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                <>
                  <article className="stat-card">
                    <SquareChartGantt size={20} className="stat-icon blue" />
                    <h3>{stats.totalSplits}</h3>
                    <p>Total Splits Created</p>
                  </article>
                  <article className="stat-card">
                    <Activity size={20} className="stat-icon orange" />
                    <h3>{stats.pendingPayments}</h3>
                    <p>Pending Payments</p>
                  </article>
                  <article className="stat-card">
                    <CirclePlus size={20} className="stat-icon green" />
                    <h3>{stats.totalXlmSent.toFixed(2)} XLM</h3>
                    <p>Total XLM Sent</p>
                  </article>
                  <article className="stat-card">
                    <ClipboardList size={20} className="stat-icon teal" />
                    <h3>{stats.settledCount}</h3>
                    <p>Splits Settled</p>
                  </article>
                </>
              )}
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-head">
                  <h2>Recent Splits</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Split ID</th>
                        <th>Label</th>
                        <th>Total</th>
                        <th>Per Person</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingData ? (
                        <>
                          <SkeletonRow />
                          <SkeletonRow />
                          <SkeletonRow />
                        </>
                      ) : recentSplits.length > 0 ? (
                        recentSplits.map((split) => (
                          <tr key={split.id}>
                            <td>{split.id}</td>
                            <td>{split.label}</td>
                            <td>{split.total}</td>
                            <td>{split.perPerson}</td>
                            <td>{split.participants}</td>
                            <td>
                              <span className={`status ${split.status === 'SETTLED' ? 'settled' : 'unpaid'}`}>
                                {split.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="view-btn"
                                onClick={() => {
                                  setCurrentSplitId(String(split.id).replace('#', ''))
                                  setActiveView('detail')
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                            No splits found. Create your first split to get started!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="create-link" onClick={() => setActiveView('create')}>
                  Create New Split →
                </button>
              </article>

              <article className="panel">
                <h2>You Owe</h2>
                {owes.length > 0 ? (
                  <div className="owe-list">
                    {owes.map((item) => (
                      <div className="owe-card" key={item.id}>
                        <h3>{item.label}</h3>
                        <p className="owe-amount">{item.amount}</p>
                        <p className="owe-creator">Creator: {item.creator}</p>
                        <button
                          type="button"
                          className="pay-btn"
                          onClick={() => {
                            setCurrentSplitId(String(item.id).replace('#', ''))
                            setActiveView('detail')
                          }}
                        >
                          Pay {item.amount}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span>✅</span>
                    <p>You're all settled up!</p>
                  </div>
                )}
              </article>
            </section>
          </>
        ) : activeView === 'create' ? (
          <section className="create-split-layout">
            <article className="create-form-card">
              <h2>New Split</h2>
              <p className="create-subtitle">Fill in the details below to create an on-chain split.</p>

              <div className="form-stack">
                <label className="field-block">
                  <span className="field-label">Split Label</span>
                  <input
                    type="text"
                    value={splitLabel}
                    onChange={(event) => setSplitLabel(event.target.value)}
                    placeholder="e.g. Team Lunch, Grab Fare, Airbnb"
                  />
                  <span className="field-helper">Optional but helpful for tracking</span>
                </label>

                <label className="field-block">
                  <span className="field-label">Total Amount</span>
                  <div className="amount-wrap">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <span className="suffix-badge">XLM</span>
                  </div>
                  <span className="field-helper">Minimum 1 XLM per participant</span>
                </label>

                <label className="field-block">
                  <span className="field-label">Token Contract</span>
                  <select value={tokenContract} onChange={(event) => setTokenContract(event.target.value)}>
                    <option>XLM (Native)</option>
                  </select>
                  <span className="field-helper">XLM is used by default on Stellar</span>
                </label>

                <div className="field-block">
                  <span className="field-label">Add Participant Wallets</span>
                  <div className="participant-row">
                    <input
                      type="text"
                      value={participantInput}
                      onChange={handleParticipantInput}
                      placeholder="G..."
                      className={participantError ? 'invalid' : ''}
                    />
                    <button type="button" className="add-btn" onClick={addParticipant}>Add</button>
                  </div>
                  {participantError && <span className="field-error">{participantError}</span>}

                  {participants.length > 0 && (
                    <div className="chips-wrap">
                      {participants.map((address) => (
                        <span key={address} className="address-chip">
                          {truncateAddress(address)}
                          <button type="button" onClick={() => removeParticipant(address)} aria-label="Remove participant">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button type="button" className="submit-split-btn" disabled={!isFormValid} onClick={createSplit}>
                Create Split on Stellar
              </button>
            </article>

            <article className="split-preview-card">
              <h3>Split Preview</h3>
              {splitLabel.trim() || parsedTotal > 0 || participants.length > 0 ? (
                <div className="preview-content">
                  <div className="preview-row">
                    <span className="preview-key">Label:</span>
                    <span className="preview-value">{splitLabel.trim() || 'Untitled Split'}</span>
                  </div>
                  <div className="preview-row">
                    <span className="preview-key">Total:</span>
                    <span className="preview-value">{parsedTotal > 0 ? `${parsedTotal.toFixed(2)} XLM` : '0.00 XLM'}</span>
                  </div>

                  <hr />

                  <div className="preview-row">
                    <span className="preview-key">Participants count:</span>
                    <span className="preview-value">{participants.length}</span>
                  </div>
                  <p className="per-person">{canComputeSplit ? `${perPerson.toFixed(2)} XLM` : '0.00 XLM'}</p>

                  <div className="preview-list">
                    {previewRows.map((row) => (
                      <div className="preview-participant-row" key={row.address}>
                        <span>{row.address}</span>
                        <span>owes {row.owes}</span>
                      </div>
                    ))}
                  </div>

                  <hr />
                  <p className="preview-note">Payments go directly to your wallet upon each pay_share()</p>
                </div>
              ) : (
                <p className="preview-empty">Fill the form to see preview</p>
              )}
            </article>
          </section>
        ) : activeView === 'created' ? (
          <section className="confirmation-page">
            <div className="confetti-layer" aria-hidden="true">
              <span className="confetti c1" />
              <span className="confetti c2" />
              <span className="confetti c3" />
              <span className="confetti c4" />
              <span className="confetti c5" />
              <span className="confetti c6" />
            </div>

            <div className="success-banner">
              <div className="success-banner-left">
                <span className="success-badge-icon"><CheckCircle2 size={18} /></span>
                <p>Split successfully created on Stellar Soroban!</p>
              </div>
              <div className="success-banner-right">
                <span>{truncatedTxHash}</span>
                <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noreferrer">
                  View on Explorer →
                </a>
              </div>
            </div>

            <article className="confirmation-card">
              <div className="confirmation-top">
                <span className="big-check"><CheckCircle2 size={34} /></span>
                <h2>Split #{splitId} Created!</h2>
                <p>Your bill has been recorded on-chain. Share the Split ID with your participants.</p>
              </div>

              <div className="details-grid">
                <div className="detail-cell">
                  <span>Split ID</span>
                  <strong className="mono-blue">#{splitId}</strong>
                </div>
                <div className="detail-cell">
                  <span>Label</span>
                  <strong>{splitLabel}</strong>
                </div>
                <div className="detail-cell">
                  <span>Total Amount</span>
                  <strong>{parsedTotal.toFixed(2)} XLM</strong>
                </div>
                <div className="detail-cell">
                  <span>Per Person</span>
                  <strong>{perPerson.toFixed(2)} XLM</strong>
                </div>
                <div className="detail-cell">
                  <span>Participants</span>
                  <strong>{participants.length}</strong>
                </div>
                <div className="detail-cell">
                  <span>Status</span>
                  <strong><span className="status unpaid">UNPAID</span></strong>
                </div>
              </div>

              <hr />

              <div className="share-section">
                <p className="share-label">Share this Split ID with participants</p>
                <div className="copy-field">
                  <span>{splitId}</span>
                  <button type="button" onClick={copySplitId}>
                    <Copy size={15} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="command-block">{`soroban contract invoke --id <CONTRACT_ID> --source <YOUR_ADDRESS> --network testnet -- pay_share --split_id ${splitId}`}</pre>
              </div>

              <div className="participant-list">
                {participants.map((address) => (
                  <div className="participant-item" key={address}>
                    <span>{truncateAddress(address)}</span>
                    <span>owes {perPerson.toFixed(2)} XLM</span>
                    <button type="button">Send Reminder</button>
                  </div>
                ))}
              </div>

              <hr />

              <div className="confirmation-actions">
                <button type="button" className="primary-action" onClick={() => setActiveView('detail')}>
                  View Split Status
                </button>
                <button type="button" className="secondary-action" onClick={() => setActiveView('create')}>
                  Create Another Split
                </button>
              </div>
            </article>
          </section>
        ) : activeView === 'detail' ? (
          <section className="split-detail-layout">
            <div className="split-detail-left">
              <article className="split-header-card">
                <div className="split-header-top">
                  <div>
                    <h2>{currentSplit?.label || 'Untitled Split'}</h2>
                    <p className="split-id">#{splitId}</p>
                  </div>
                  <span className={`status large ${isSettled ? 'settled' : 'unpaid'}`}>
                    {isSettled ? 'SETTLED' : 'UNPAID'}
                  </span>
                </div>

                <p className="split-meta">
                  Created by {truncateAddress(currentSplit?.creator)} · {currentSplit?.participants.length || 0} participants · {currentSplit?.total_xlm.toFixed(2) || 0} XLM total · {currentSplit ? new Date(currentSplit.created_at).toLocaleDateString() : '---'}
                </p>

                <hr />

                <div className="progress-head">
                  <span>Payment Progress</span>
                  <span>{paidCount} of {currentSplit?.participants.length || 0} participants paid</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${currentSplit ? (paidCount / currentSplit.participants.length) * 100 : 0}%` }} />
                </div>
                <p className="progress-caption">{totalCollected.toFixed(2)} XLM collected of {currentSplit?.total_xlm.toFixed(2) || 0} XLM</p>
              </article>

              <article className="participants-card">
                <h3>Participants</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Address</th>
                        <th>Amount Owed</th>
                        <th>Status</th>
                        <th>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSplit?.participants.map((p, idx) => (
                        <tr key={p.address}>
                          <td>{idx + 1}</td>
                          <td>{truncateAddress(p.address)}</td>
                          <td>{p.amount_owed_xlm.toFixed(2)} XLM</td>
                          <td><span className={`status ${p.paid ? 'settled' : 'unpaid'}`}>{p.paid ? 'Paid' : 'Unpaid'}</span></td>
                          <td>{p.paid_at ? new Date(p.paid_at).toLocaleTimeString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div className="split-detail-right">
              <article className={`your-payment-card ${currentSplit?.participants.find(p => p.address === publicKey)?.paid ? 'paid' : 'unpaid'}`}>
                {!currentSplit?.participants.find(p => p.address === publicKey)?.paid ? (
                  <>
                    <h3>You owe {currentSplit?.per_person_xlm.toFixed(2) || 0} XLM</h3>
                    <p>Creator: {truncateAddress(currentSplit?.creator)}</p>
                    <button type="button" onClick={() => setActiveView('pay')}>Pay Now</button>
                    <small>This triggers an on-chain XLM transfer</small>
                  </>
                ) : (
                  <div className="paid-state">
                    <span>✅</span>
                    <h3>You paid {currentSplit?.per_person_xlm.toFixed(2) || 0} XLM</h3>
                    <p>Paid {currentSplit?.participants.find(p => p.address === publicKey)?.paid_at ? new Date(currentSplit?.participants.find(p => p.address === publicKey)?.paid_at).toLocaleTimeString() : 'recently'}</p>
                  </div>
                )}
              </article>

              <article className="split-info-card">
                <h3>Split Info</h3>
                <div className="info-row"><span>Split ID:</span><strong>{splitId}</strong></div>
                <div className="info-row"><span>Token:</span><strong>XLM</strong></div>
                <div className="info-row">
                  <span>Contract:</span>
                  <strong className="mono-inline">CCXX...</strong>
                  <button type="button" className="tiny-copy-btn"><Copy size={12} /></button>
                </div>
                <div className="info-row">
                  <span>Tx Hash:</span>
                  <strong className="mono-inline">BAXX...</strong>
                  <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noreferrer">View on Explorer</a>
                </div>
              </article>

              <article className={`settlement-card ${isSettled ? 'settled' : ''}`}>
                <h3>Settlement Status: {isSettled ? 'SETTLED' : 'Pending'}</h3>
              </article>
            </div>
          </section>
        ) : activeView === 'pay' ? (
          <section className="payment-page">
            <article className="payment-card">
              <h2>Pay Your Share</h2>
              <p className="payment-subtitle">
                Review the payment details before signing the transaction.
              </p>

              <div className="split-context-row">
                <span>Split #{splitId} — {currentSplit?.label || 'Untitled'}</span>
                <span>Created by {truncateAddress(currentSplit?.creator)}</span>
              </div>

              <hr />

              <div className="payment-amount">
                <p>You are paying</p>
                <h3>{currentSplit?.per_person_xlm.toFixed(2) || 0} XLM</h3>
                <span>≈ ${((currentSplit?.per_person_xlm || 0) * 0.095).toFixed(2)} USD</span>
              </div>

              <div className="payment-detail-list">
                <div className="payment-detail-row">
                  <span>From:</span>
                  <strong>{truncateAddress(publicKey)}</strong>
                </div>
                <div className="payment-detail-row">
                  <span>To:</span>
                  <strong>{truncateAddress(currentSplit?.creator)}</strong>
                </div>
                <div className="payment-detail-row">
                  <span>Network Fee:</span>
                  <strong>~0.00001 XLM</strong>
                </div>
                <div className="payment-detail-row">
                  <span>Token:</span>
                  <strong>XLM (Native Stellar)</strong>
                </div>
              </div>

              <hr />

              <div className="payment-warning">
                <span>⚠️</span>
                <p>
                  This action will execute an irreversible on-chain XLM transfer via Soroban smart contract.
                  Please review before confirming.
                </p>
              </div>

              <span className="payment-state-label">
                {paymentState === 'default' && 'DEFAULT'}
                {paymentState === 'loading' && 'LOADING'}
                {paymentState === 'error' && 'ERROR'}
              </span>

              {paymentState === 'error' && (
                <div className="payment-error">
                  <span>Transaction failed: Insufficient balance</span>
                  <button type="button" onClick={retryPayment}>Try Again</button>
                </div>
              )}

              <div className="payment-actions">
                <button
                  type="button"
                  className="confirm-pay-btn"
                  disabled={paymentState === 'loading'}
                  onClick={startPayment}
                >
                  {paymentState === 'loading' ? (
                    <>
                      <span className="payment-spinner" />
                      Submitting to Stellar...
                    </>
                  ) : (
                    'Confirm & Pay ' + (currentSplit?.per_person_xlm.toFixed(2) || 0) + ' XLM'
                  )}
                </button>
                <button
                  type="button"
                  className="cancel-pay-btn"
                  disabled={paymentState === 'loading'}
                  onClick={() => setActiveView('detail')}
                >
                  Cancel
                </button>
              </div>
            </article>
          </section>
        ) : activeView === 'pay-success' ? (
          <section className="payment-success-page">
            <div className="success-confetti-layer" aria-hidden="true">
              <span className="success-confetti s1" />
              <span className="success-confetti s2" />
              <span className="success-confetti s3" />
              <span className="success-confetti s4" />
              <span className="success-confetti s5" />
            </div>

            <div className="payment-success-top">
              <span className="payment-success-check"><CheckCircle2 size={42} /></span>
              <h2>Payment Sent!</h2>
              <p>Your {currentSplit?.per_person_xlm.toFixed(2) || 0} XLM has been successfully transferred on Stellar.</p>
            </div>

            <article className="receipt-card">
              <div className="receipt-header">
                <h3>Transaction Receipt</h3>
                <span>{new Date().toLocaleString()}</span>
              </div>

              <hr />

              <div className="receipt-amount">
                <p>Amount Paid</p>
                <h4>{currentSplit?.per_person_xlm.toFixed(2) || 0} XLM</h4>
                <span>≈ ${((currentSplit?.per_person_xlm || 0) * 0.095).toFixed(2)}</span>
              </div>

              <div className="receipt-grid">
                <div className="receipt-row alt"><span>Split:</span><strong>#7 — Team Lunch</strong></div>
                <div className="receipt-row"><span>From:</span><strong>GXXX...Bob (Your wallet)</strong></div>
                <div className="receipt-row alt"><span>To:</span><strong>GXXX...Alice</strong></div>
                <div className="receipt-row"><span>Status:</span><strong>✅ Confirmed</strong></div>
                <div className="receipt-row alt">
                  <span>Tx Hash:</span>
                  <strong className="mono-inline">BAXX...</strong>
                  <button type="button" className="tiny-copy-btn" onClick={copyTxHash}>
                    <Copy size={12} />
                  </button>
                  <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noreferrer">
                    View on Stellar Explorer →
                  </a>
                </div>
                <div className="receipt-row"><span>Block:</span><strong>included in ledger #XXXXX</strong></div>
              </div>

              <hr />

              <div className="split-progress-update">
                <div className="progress-head">
                  <span>Split #7 Progress</span>
                  <span>2 of 3 paid</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '67%' }} />
                </div>
                <p>1 participant still hasn't paid</p>
              </div>

              <div className="receipt-actions">
                <button type="button" className="primary-action" onClick={() => setActiveView('detail')}>
                  View Split #{splitId}
                </button>
                <button type="button" className="secondary-action" onClick={() => setActiveView('dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            </article>
          </section>
        ) : activeView === 'settings' ? (
          <section className="settings-page">
            <div className="settings-grid">
              <article className="settings-profile-card">
                <span className="settings-avatar">{publicKey?.[0]?.toUpperCase() || '?'}</span>
                <div className="settings-wallet-row">
                  <code>{publicKey}</code>
                  <button type="button" className="tiny-copy-btn" onClick={copySplitId}><Copy size={12} /></button>
                </div>
                <span className="network-chip">Testnet</span>

                <p className="settings-balance-label">XLM Balance</p>
                <p className="settings-balance-value">-- XLM</p>

                <hr />

                <div className="settings-stats">
                  <div><span>Splits Created</span><strong>--</strong></div>
                  <div><span>Splits Paid</span><strong>--</strong></div>
                  <div><span>Splits Settled</span><strong>--</strong></div>
                  <div><span>Total XLM Sent</span><strong>-- XLM</strong></div>
                </div>
              </article>

              <div className="settings-right">
                <article className="settings-card">
                  <h3>Network</h3>
                  <div className="settings-row">
                    <span>Active Network</span>
                    <div className="settings-row-right">
                      <button
                        type="button"
                        className={`switch-pill ${activeNetwork === 'Mainnet' ? 'on' : ''}`}
                        onClick={() => {
                          const nextActiveNetwork = activeNetwork === 'Testnet' ? 'Mainnet' : 'Testnet'
                          setActiveNetwork(nextActiveNetwork)
                          saveSettings({
                            activeNetwork: nextActiveNetwork,
                            currency,
                            dateFormat,
                            notifyPaymentReceived,
                            notifySplitSettled,
                            notifyPaymentReminder
                          })
                        }}
                      >
                        <span />
                      </button>
                      <span className={`network-state-badge ${activeNetwork === 'Mainnet' ? 'mainnet' : 'testnet'}`}>
                        {activeNetwork}
                      </span>
                    </div>
                  </div>
                </article>

                <article className="settings-card">
                  <h3>Display Preferences</h3>
                  <div className="settings-row">
                    <span>Currency</span>
                    <select
                      value={currency}
                      onChange={(event) => {
                        const nextCurrency = event.target.value
                        setCurrency(nextCurrency)
                        saveSettings({
                          activeNetwork,
                          currency: nextCurrency,
                          dateFormat,
                          notifyPaymentReceived,
                          notifySplitSettled,
                          notifyPaymentReminder
                        })
                      }}
                    >
                      <option>XLM</option>
                      <option>USD</option>
                      <option>PHP</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <span>Date Format</span>
                    <select
                      value={dateFormat}
                      onChange={(event) => {
                        const nextDateFormat = event.target.value
                        setDateFormat(nextDateFormat)
                        saveSettings({
                          activeNetwork,
                          currency,
                          dateFormat: nextDateFormat,
                          notifyPaymentReceived,
                          notifySplitSettled,
                          notifyPaymentReminder
                        })
                      }}
                    >
                      <option>MM/DD/YYYY</option>
                      <option>DD/MM/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                </article>

                <article className="settings-card">
                  <h3>Notifications</h3>
                  <div className="settings-row">
                    <span>Payment received</span>
                    <button
                      type="button"
                      className={`switch-pill ${notifyPaymentReceived ? 'on' : ''}`}
                      onClick={() => {
                        const next = !notifyPaymentReceived
                        setNotifyPaymentReceived(next)
                        saveSettings({
                          activeNetwork,
                          currency,
                          dateFormat,
                          notifyPaymentReceived: next,
                          notifySplitSettled,
                          notifyPaymentReminder
                        })
                      }}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="settings-row">
                    <span>Split settled</span>
                    <button
                      type="button"
                      className={`switch-pill ${notifySplitSettled ? 'on' : ''}`}
                      onClick={() => {
                        const next = !notifySplitSettled
                        setNotifySplitSettled(next)
                        saveSettings({
                          activeNetwork,
                          currency,
                          dateFormat,
                          notifyPaymentReceived,
                          notifySplitSettled: next,
                          notifyPaymentReminder
                        })
                      }}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="settings-row">
                    <span>Payment reminder</span>
                    <button
                      type="button"
                      className={`switch-pill ${notifyPaymentReminder ? 'on' : ''}`}
                      onClick={() => {
                        const next = !notifyPaymentReminder
                        setNotifyPaymentReminder(next)
                        saveSettings({
                          activeNetwork,
                          currency,
                          dateFormat,
                          notifyPaymentReceived,
                          notifySplitSettled,
                          notifyPaymentReminder: next
                        })
                      }}
                    >
                      <span />
                    </button>
                  </div>
                </article>

                <article className="settings-card">
                  <button type="button" className="developer-toggle" onClick={() => setDeveloperExpanded((prev) => !prev)}>
                    <h3>Developer</h3>
                    <span>{developerExpanded ? 'Hide' : 'Show'}</span>
                  </button>
                  {developerExpanded && (
                    <div className="developer-content">
                      <div className="settings-row">
                        <span>Contract ID</span>
                        <div className="settings-row-right">
                          <code>CCXX...SPLITPAY</code>
                          <button type="button" className="tiny-copy-btn" onClick={copyTxHash}><Copy size={12} /></button>
                        </div>
                      </div>
                      <div className="settings-row">
                        <span>RPC URL</span>
                        <code>https://soroban-testnet.stellar.org</code>
                      </div>
                    </div>
                  )}
                </article>

                <article className="settings-card danger-zone">
                  <h3>Danger Zone</h3>
                  <div className="settings-row">
                    <div>
                      <strong>Disconnect Wallet</strong>
                      <p>Disconnect this wallet from your current SplitPay session.</p>
                    </div>
                    <button type="button" className="danger-btn" onClick={() => setShowDisconnectModal(true)}>
                      Disconnect
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </section>
        ) : (
          <section className="activity-page">
            <div className="activity-controls">
              <div className="filter-pills">
                {['All', 'Created', 'Paid', 'Settled', 'Received'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`filter-pill ${activityFilter === filter ? 'active' : ''}`}
                    onClick={() => setActivityFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="activity-actions">
                <select className="date-range-select" defaultValue="Last 30 days">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>This month</option>
                </select>
                <button type="button" className="export-btn">Export CSV</button>
              </div>
            </div>

            {hasActivity ? (
              <article className="activity-table-card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Event</th>
                        <th>Split</th>
                        <th>Amount</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityRows.map((row, index) => (
                        <tr key={`${row.event}-${index}`}>
                          <td>
                            <span className={`activity-icon ${row.iconClass}`}>{row.icon}</span>
                          </td>
                          <td>{row.event}</td>
                          <td>{row.split}</td>
                          <td>{row.amount}</td>
                          <td>{row.participants}</td>
                          <td>
                            {row.status === '—' ? (
                              '—'
                            ) : (
                              <span
                                className={`status ${row.status === 'UNPAID'
                                    ? 'unpaid'
                                    : row.status === 'PAID'
                                      ? 'settled'
                                      : 'teal'
                                  }`}
                              >
                                {row.status}
                              </span>
                            )}
                          </td>
                          <td>{row.date}</td>
                          <td>
                            <button
                              type="button"
                              className="view-btn"
                              onClick={() => {
                                const match = row.event.match(/#(\d+)/)
                                if (match) setCurrentSplitId(match[1])
                                setActiveView('detail')
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="activity-pagination">
                  <span>Showing 1–5 of 12</span>
                  <div>
                    <button type="button" className="page-btn">Previous</button>
                    <button type="button" className="page-btn">Next</button>
                  </div>
                </div>
              </article>
            ) : (
              <article className="activity-empty">
                <div className="wallet-illustration" aria-hidden="true">
                  <div className="wallet-body" />
                  <div className="wallet-slot" />
                </div>
                <h3>No activity yet</h3>
                <p>Create your first split to get started.</p>
                <button type="button" className="primary-action" onClick={() => setActiveView('create')}>
                  Create Split →
                </button>
              </article>
            )}
          </section>
        )}
      </main>

      {showDisconnectModal && (
        <div className="disconnect-overlay" role="dialog" aria-modal="true" aria-labelledby="disconnect-title">
          <div className="disconnect-modal">
            <div className="disconnect-icon-wrap">
              <Wallet size={24} />
              <span className="broken-link-icon"><Unlink size={14} /></span>
            </div>
            <h2 id="disconnect-title">Disconnect Wallet?</h2>
            <p>
              You will be logged out of SplitPay. Any unsettled splits will still be recorded on-chain and accessible
              when you reconnect.
            </p>

            <div className="disconnect-wallet-row">
              <span className="freighter-mini">F</span>
              <span>{truncateAddress(publicKey)}</span>
              <span className="network-chip">Testnet</span>
            </div>

            <hr />

            <div className="disconnect-actions">
              <button type="button" className="disconnect-confirm-btn" onClick={onDisconnect}>
                Disconnect Wallet
              </button>
              <button type="button" className="disconnect-cancel-btn" onClick={() => setShowDisconnectModal(false)}>
                Cancel — Stay Connected
              </button>
            </div>

            <small>
              Your funds and on-chain data are safe. Disconnecting only removes local session access.
            </small>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
          type="button"
        >
          <House size={20} />
          <span>Home</span>
        </button>
        <button
          className={`mobile-nav-item ${activeView === 'create' ? 'active' : ''}`}
          onClick={() => setActiveView('create')}
          type="button"
        >
          <CirclePlus size={20} />
          <span>New</span>
        </button>
        <button
          className={`mobile-nav-item ${activeView === 'created' ? 'active' : ''}`}
          onClick={() => setActiveView('created')}
          type="button"
        >
          <ClipboardList size={20} />
          <span>Splits</span>
        </button>
        <button
          className={`mobile-nav-item ${activeView === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveView('activity')}
          type="button"
        >
          <Activity size={20} />
          <span>History</span>
        </button>
        <button
          className={`mobile-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
          type="button"
        >
          <Settings size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}

export default Dashboard
