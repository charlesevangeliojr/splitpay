import { useState } from 'react'
import './ViewSplit.css'

function ViewSplit({ publicKey }) {
  const [splitId, setSplitId] = useState('')
  const [splitData, setSplitData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)

  const fetchSplit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // TODO: Integrate with Soroban contract
    // Mock data for now
    setTimeout(() => {
      setSplitData({
        splitId: parseInt(splitId),
        creator: 'GCMXJL4PURZ56QKTA4WD4CJ2N3NSJW6PJK65GE2GV2DYINPFXZQNQ5CE',
        totalAmount: 400,
        amountPerPerson: 100,
        participants: [
          { address: 'GCMXJL4PURZ56QKTA4WD4CJ2N3NSJW6PJK65GE2GV2DYINPFXZQNQ5CE', paid: true },
          { address: 'GBOB...XYZ', paid: false },
          { address: 'GALICE...ABC', paid: false },
        ],
        token: 'Native XLM',
        status: 'Active',
        isSettled: false
      })
      setLoading(false)
    }, 1000)
  }

  const payShare = async () => {
    setPayLoading(true)
    
    // TODO: Integrate with Soroban contract
    console.log('Paying share for split:', splitId)
    
    setTimeout(() => {
      setPayLoading(false)
      alert('Payment submitted! (This is a mock - integrate with contract)')
    }, 2000)
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
      <h2>View Split</h2>
      
      {!splitData ? (
        <form onSubmit={fetchSplit} className="fetch-form">
          <div className="form-group">
            <label>Split ID</label>
            <input
              type="number"
              value={splitId}
              onChange={(e) => setSplitId(e.target.value)}
              placeholder="Enter split ID"
              required
            />
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Loading...' : 'View Split'}
          </button>
        </form>
      ) : (
        <div className="split-details">
          <div className="split-header">
            <h3>Split #{splitData.splitId}</h3>
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
            View Another Split
          </button>
        </div>
      )}
    </div>
  )
}

export default ViewSplit
