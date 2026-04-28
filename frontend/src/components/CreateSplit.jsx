import { useState } from 'react'
import './CreateSplit.css'

function CreateSplit({ publicKey }) {
  const [totalAmount, setTotalAmount] = useState('')
  const [participants, setParticipants] = useState([''])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const addParticipant = () => {
    setParticipants([...participants, ''])
  }

  const removeParticipant = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index))
    }
  }

  const updateParticipant = (index, value) => {
    const newParticipants = [...participants]
    newParticipants[index] = value
    setParticipants(newParticipants)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // TODO: Integrate with Soroban contract
    console.log({
      creator: publicKey,
      totalAmount: parseFloat(totalAmount) * 10000000, // Convert to stroops
      participants: participants.filter(p => p.trim()),
      token
    })
    
    setTimeout(() => {
      setResult({
        splitId: Math.floor(Math.random() * 1000),
        amountPerPerson: (parseFloat(totalAmount) / participants.length).toFixed(2)
      })
      setLoading(false)
    }, 1500)
  }

  const sharePerPerson = totalAmount && participants.length > 0
    ? (parseFloat(totalAmount) / participants.length).toFixed(2)
    : '0.00'

  return (
    <div className="create-split">
      <h2>Create New Split</h2>
      
      {result ? (
        <div className="success-message">
          <h3>✅ Split Created!</h3>
          <p>Split ID: <strong>#{result.splitId}</strong></p>
          <p>Each person pays: <strong>{result.amountPerPerson} XLM</strong></p>
          <button onClick={() => setResult(null)} className="create-another-btn">
            Create Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Total Amount (XLM)</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g., 100"
              required
            />
          </div>

          <div className="form-group">
            <label>Participants</label>
            {participants.map((addr, index) => (
              <div key={index} className="participant-input">
                <input
                  type="text"
                  value={addr}
                  onChange={(e) => updateParticipant(index, e.target.value)}
                  placeholder={`Participant ${index + 1} address`}
                  required
                />
                {participants.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeParticipant(index)}
                    className="remove-btn"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addParticipant} className="add-btn">
              + Add Participant
            </button>
          </div>

          <div className="form-group">
            <label>Token Contract ID (optional)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Leave empty for native XLM"
            />
          </div>

          <div className="summary">
            <p>Each person pays: <strong>{sharePerPerson} XLM</strong></p>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Split'}
          </button>
        </form>
      )}
    </div>
  )
}

export default CreateSplit
