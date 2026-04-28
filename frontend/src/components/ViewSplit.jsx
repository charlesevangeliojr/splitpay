import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import './ViewSplit.css'

function ViewSplit({ publicKey }) {
  const [splits, setSplits] = useState([])
  const [selectedSplit, setSelectedSplit] = useState(null)
  const [splitData, setSplitData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSplits()
  }, [])

  const loadSplits = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSplits()
      setSplits(data)
    } catch (err) {
      setError(err.message || 'Failed to load splits')
    } finally {
      setLoading(false)
    }
  }

  const viewSplit = (split) => {
    setSelectedSplit(split.id)
    setSplitData({
      splitId: split.id,
      creator: split.creator,
      totalAmount: split.total_xlm,
      amountPerPerson: split.per_person_xlm,
      participants: split.participants.map(p => ({
        address: p.address,
        paid: p.paid,
        paidAt: p.paid_at
      })),
      token: 'Native XLM',
      status: split.status,
      isSettled: split.status === 'SETTLED',
      label: split.label
    })
  }

  const payShare = async () => {
    if (!splitData) return
    setPayLoading(true)
    setError(null)

    try {
      await api.payShare(splitData.splitId, publicKey)
      // Refresh split data after payment
      const updatedSplit = {
        ...splitData,
        participants: splitData.participants.map(p =>
          p.address === publicKey ? { ...p, paid: true } : p
        )
      }
      // Check if all paid
      const allPaid = updatedSplit.participants.every(p => p.paid)
      if (allPaid) {
        updatedSplit.status = 'SETTLED'
        updatedSplit.isSettled = true
      }
      setSplitData(updatedSplit)
      // Refresh the splits list
      await loadSplits()
    } catch (err) {
      setError(err.message || 'Failed to process payment')
    } finally {
      setPayLoading(false)
    }
  }

  const isParticipant = (addr) => {
    return addr === publicKey
  }

  const hasPaid = () => {
    if (!splitData) return false
    const me = splitData.participants.find(p => p.address === publicKey)
    return me ? me.paid : false
  }

  return (
    <div className="view-split">
      <h2>My Splits</h2>

      {error && <div className="error-message">{error}</div>}

      {!splitData ? (
        <div className="splits-list">
          {loading ? (
            <p>Loading splits...</p>
          ) : splits.length === 0 ? (
            <div className="empty-state">
              <p>No splits found.</p>
              <p>Create a new split to get started!</p>
            </div>
          ) : (
            <>
              {splits.map((split) => (
                <div
                  key={split.id}
                  className={`split-card ${split.status.toLowerCase()}`}
                  onClick={() => viewSplit(split)}
                >
                  <div className="split-card-header">
                    <h4>{split.label || split.id}</h4>
                    <span className={`status-badge ${split.status.toLowerCase()}`}>
                      {split.status}
                    </span>
                  </div>
                  <div className="split-card-body">
                    <p><strong>Total:</strong> {split.total_xlm} XLM</p>
                    <p><strong>Per person:</strong> {split.per_person_xlm.toFixed(2)} XLM</p>
                    <p><strong>Participants:</strong> {split.participants.length}</p>
                  </div>
                </div>
              ))}
              <button onClick={loadSplits} className="refresh-btn" disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="split-details">
          <div className="split-header">
            <h3>{splitData.label || splitData.splitId}</h3>
            <span className={`status-badge ${splitData.isSettled ? 'settled' : 'active'}`}>
              {splitData.status}
            </span>
          </div>

          <div className="info-section">
            <p><strong>Creator:</strong> {splitData.creator.slice(0, 6)}...{splitData.creator.slice(-4)}</p>
            <p><strong>Total Amount:</strong> {splitData.totalAmount} XLM</p>
            <p><strong>Per Person:</strong> {splitData.amountPerPerson} XLM</p>
            <p><strong>Token:</strong> {splitData.token}</p>
          </div>

          <div className="participants-section">
            <h4>Participants</h4>
            <ul className="participant-list">
              {splitData.participants.map((p, index) => (
                <li key={index} className={`participant-item ${p.paid ? 'paid' : 'unpaid'}`}>
                  <span className="participant-address">
                    {p.address === publicKey ? 'You' : `${p.address.slice(0, 6)}...${p.address.slice(-4)}`}
                  </span>
                  <span className={`payment-status ${p.paid ? 'paid' : 'unpaid'}`}>
                    {p.paid ? '✅ Paid' : '❌ Unpaid'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {isParticipant(publicKey) && !hasPaid() && splitData.status === 'Active' && (
            <button
              onClick={payShare}
              className="pay-btn"
              disabled={payLoading}
            >
              {payLoading ? 'Processing...' : `Pay ${splitData.amountPerPerson} XLM`}
            </button>
          )}

          <button onClick={() => setSplitData(null)} className="back-btn">
            Back to Splits
          </button>
        </div>
      )}
    </div>
  )
}

export default ViewSplit
