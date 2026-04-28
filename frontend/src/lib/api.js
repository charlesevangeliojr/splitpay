const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  if (!response.ok) {
    let message = `Request failed: ${response.status}`
    try {
      const data = await response.json()
      if (data?.message) message = data.message
    } catch {
      // no-op: keep default message
    }
    throw new Error(message)
  }

  return response.json()
}

export const api = {
  connectWallet(walletAddress) {
    return request('/api/session/connect', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: walletAddress })
    })
  },

  disconnectWallet(walletAddress) {
    return request(`/api/session/${encodeURIComponent(walletAddress)}/disconnect`, {
      method: 'POST'
    })
  },

  getSplits() {
    return request('/api/splits')
  },

  createSplit(payload) {
    return request('/api/splits', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  payShare(splitId, payer) {
    const id = String(splitId).replace(/^#/, '')
    return request(`/api/splits/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payer })
    })
  },

  getActivity(filter = 'all') {
    return request(`/api/activity?filter=${encodeURIComponent(filter)}`)
  },

  getSettings(walletAddress) {
    return request(`/api/settings/${encodeURIComponent(walletAddress)}`)
  },

  updateSettings(walletAddress, payload) {
    return request(`/api/settings/${encodeURIComponent(walletAddress)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }
}
