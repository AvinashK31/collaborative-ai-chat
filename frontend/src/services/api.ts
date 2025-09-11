import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to ensure access_token is always included
api.interceptors.request.use((config) => {
  const access_token = localStorage.getItem('access_token')
  if (access_token) {
    config.headers.Authorization = `Bearer ${access_token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Response interceptor to handle auth errors
api.interceptors.response.use((response) => {
  return response
}, (error) => {
  if (error.response?.status === 401) {
    // Clear invalid access_token
    localStorage.removeItem('access_token')
    delete api.defaults.headers.common['Authorization']
    // Optionally redirect to login - but let the AuthContext handle this
  }
  return Promise.reject(error)
})

// Auth API
export const authApi = {
  setToken: (access_token: string) => {
    if (access_token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name })
    return response.data
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile')
    return response.data
  },
}

// Conversations API
export const conversationsApi = {
  getConversations: async () => {
    const response = await api.get('/conversations')
    return response.data
  },

  createConversation: async (title?: string) => {
    const response = await api.post('/conversations', { title })
    return response.data
  },

  getConversation: async (id: string) => {
    const response = await api.get(`/conversations/${id}`)
    return response.data
  },

  updateConversation: async (id: string, title: string) => {
    const response = await api.patch(`/conversations/${id}`, { title })
    return response.data
  },

  deleteConversation: async (id: string) => {
    await api.delete(`/conversations/${id}`)
  },
}

// Messages API
export const messagesApi = {
  getMessages: async (conversationId: string) => {
    const response = await api.get(`/messages/conversation/${conversationId}`)
    return response.data
  },

  getUnreadCounts: async () => {
    const response = await api.get('/messages/unread-counts')
    return response.data
  },

  markConversationAsRead: async (conversationId: string) => {
    const response = await api.post(`/messages/mark-read/${conversationId}`)
    return response.data
  },

  sendMessageWithAI: (conversationId: string, content: string, onMessage: (data: Record<string, unknown>) => void) => {
    const access_token = localStorage.getItem('access_token')
    const url = `${API_BASE_URL}/messages/send-with-ai`
    
    // Use fetch with streaming instead of EventSource for better control
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        content,
        contextType: 'CONVERSATION', // Always use conversation context
      }),
    })
    .then(response => {
      if (!response.body) throw new Error('No response body')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            // SSE events are separated by a blank line (\n\n)
            const events = buffer.split('\n\n')
            // Keep the last partial chunk in the buffer
            buffer = events.pop() || ''

            for (const evt of events) {
              // Each event can have multiple lines; we only care about data: lines
              const dataLines = evt
                .split('\n')
                .filter(l => l.startsWith('data: '))
                .map(l => l.slice(6))

              if (dataLines.length === 0) continue

              const payload = dataLines.join('\n')
              try {
                const data = JSON.parse(payload)
                onMessage(data)
                if (data.type === 'complete') return
              } catch (error) {
                // Incomplete JSON may happen across chunks; re-buffer and continue
                buffer = payload + '\n\n' + buffer
              }
            }
          }
        } catch (error) {
          console.error('Stream reading error:', error)
        }
      }
      
      readStream()
    })
    .catch(error => {
      console.error('Fetch error:', error)
      onMessage({ type: 'error', error: 'Failed to send message' })
    })
  },

  updateMessage: async (messageId: string, content: string) => {
    const response = await api.patch(`/messages/${messageId}`, { content })
    return response.data
  },
}

// Invitations API
export const invitationsApi = {
  sendInvitation: async (email: string, conversationId: string) => {
    const response = await api.post('/invitations', { email, conversationId })
    return response.data
  },

  getInvitations: async () => {
    const response = await api.get('/invitations')
    return response.data
  },

  acceptInvitation: async (invitationId: string) => {
    const response = await api.post(`/invitations/${invitationId}/accept`)
    return response.data
  },

  declineInvitation: async (invitationId: string) => {
    const response = await api.post(`/invitations/${invitationId}/decline`)
    return response.data
  },
}

export default api 
