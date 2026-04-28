import { useState } from 'react'
import { api } from '../lib/api'
import './CreateSplit.css'

function CreateSplit({ publicKey }) {
  const [label, setLabel] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [participants, setParticipants] = useState([''])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

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
    setError(null)

    try {
      const validParticipants = participants.filter(p => p.trim())
      const response = await api.createSplit({
        label: label || `Split #${Date.now()}`,
        creator: publicKey,
        total_xlm: parseFloat(totalAmount),
        participants: validParticipants
      })

      setResult({
        splitId: response.id,
        amountPerPerson: response.per_person_xlm.toFixed(2)
      })
    } catch (err) {
      setError(err.message || 'Failed to create split')
    } finally {
      setLoading(false)
    }
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
          <p>Split ID: <strong>{result.splitId}</strong></p>
          <p>Each person pays: <strong>{result.amountPerPerson} XLM</strong></p>
          <button onClick={() => { setResult(null); setLabel(''); setTotalAmount(''); setParticipants(['']); }} className="create-another-btn">
            Create Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Split Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Dinner with friends"
            />
          </div>

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
            <label>Participants (Stellar Addresses)</label>
            {participants.map((addr, index) => (
              <div key={index} className="participant-input">
                <input
                  type="text"
                  value={addr}
                  onChange={(e) => updateParticipant(index, e.target.value)}
                  placeholder={`Participant ${index + 1} address (G...)`}
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
