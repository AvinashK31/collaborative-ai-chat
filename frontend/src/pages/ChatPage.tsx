import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { conversationsApi, messagesApi, invitationsApi } from '../services/api'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Participant {
  id: string
  user: {
    id: string
    name?: string
    email: string
  }
}

interface Conversation {
  id: string
  title: string | null
  participants: Participant[]
  messages?: Message[]
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  content: string
  type: 'USER' | 'AI' | 'SYSTEM'
  userId?: string
  conversationId?: string
  user?: {
    id: string
    name?: string
    email: string
  }
  createdAt: string
  updatedAt?: string
  isStreaming?: boolean
}

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { socket, isConnected } = useSocket()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [pendingInvitations, setPendingInvitations] = useState(0)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [typingTimeout, setTypingTimeout] = useState<number | null>(null)
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editConversationTitle, setEditConversationTitle] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)
  const [editingUsers, setEditingUsers] = useState<{[messageId: string]: string[]}>({})
  const [editingConversationUsers, setEditingConversationUsers] = useState<string[]>([])
  const [userStatuses, setUserStatuses] = useState<{[conversationId: string]: {[userId: string]: 'online' | 'away' | 'offline'}}>({})
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [unreadCounts, setUnreadCounts] = useState<{[conversationId: string]: number}>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only load if user is authenticated
    if (user) {
      loadConversations()
      loadPendingInvitations()
      loadUnreadCounts() // Load persisted unread counts
    }
  }, [user]) // Depend on user instead of empty array

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      markConversationAsRead(selectedConversation.id) // Mark as read when entering
      
      // Clear typing indicators when switching conversations
      setTypingUsers([])
      
      // Clear editing indicators when switching conversations
      setEditingUsers({})
      setEditingConversationUsers([])
    }
  }, [selectedConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (socket && isConnected) {
      console.log('🌐 Setting up unified message listener')
      console.log('🌐 Socket connected:', socket.connected)
      console.log('🌐 Socket ID:', socket.id)
      console.log('🌐 User:', user?.email)
      console.log('🌐 Selected conversation:', selectedConversation?.id)
      
      // Join conversation if one is selected
      if (selectedConversation) {
        console.log('🌐 Attempting to join conversation:', selectedConversation.id)
        socket.emit('join-conversation', { conversationId: selectedConversation.id })
        console.log('🌐 Join conversation event emitted for:', selectedConversation.id)
      }

      // SINGLE UNIFIED MESSAGE LISTENER for ALL scenarios
      const handleUnifiedMessage = (message: Message) => {
        console.log('🌐 Unified message received:', JSON.stringify(message, null, 2))
        console.log('🌐 Current selected conversation:', selectedConversation?.id)
        console.log('🌐 Message conversation:', message.conversationId)
        console.log('🌐 Message user:', message.userId)
        console.log('🌐 Current user:', user?.id)
        console.log('🌐 Message type:', message.type)
        console.log('🌐 Message content:', message.content?.substring(0, 50) + '...')
        console.log('🌐 Message object keys:', Object.keys(message))
        console.log('🌐 Message conversationId direct access:', (message as any).conversationId)
        
        // Check if this message is for the current conversation
        const isCurrentConversation = selectedConversation && message.conversationId === selectedConversation.id
        const isCrossConversation = selectedConversation && message.conversationId !== selectedConversation.id
        const isNoConversationSelected = !selectedConversation
        
        // Always process messages for the current conversation
        if (isCurrentConversation) {
          console.log('🌐 Processing message for current conversation')
          
          // Add message to current conversation's message list
          setMessages(prev => {
            // Check for exact message ID match to avoid duplicates
            const exactMatch = prev.find(msg => msg.id === message.id)
            if (exactMatch) {
              console.log('🌐 Exact message already exists, skipping:', message.id)
              return prev
            }
            
            // For AI messages, check for temporary streaming message replacement
            if (message.type === 'AI') {
              const streamingMessageIndex = prev.findIndex(msg => 
                (msg.id.includes('streaming-ai-') || msg.id.includes('regenerating-ai-')) && 
                msg.type === 'AI'
              )
              if (streamingMessageIndex !== -1) {
                console.log('🌐 Replacing streaming AI message with final AI message:', message.id)
                const updatedMessages = [...prev]
                updatedMessages[streamingMessageIndex] = message
                return updatedMessages
              }
            }
            
            console.log('🌐 Adding new message to current conversation:', message.id)
            return [...prev, message]
          })
          
          // Handle notifications for messages from other users
          if (message.userId !== user?.id) {
            // Play sound for messages from other users
            playNotificationSound()
            
            // Show notification if tab is hidden
            if (document.hidden && notificationPermission === 'granted') {
              const senderName = message.user?.name || message.user?.email || 'Someone'
              const conversationTitle = selectedConversation?.title || 'Chat'
              
              if (message.type === 'AI') {
                showNotification(
                  `🤖 AI Response in ${conversationTitle}`,
                  message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                  selectedConversation?.id
                )
              } else {
                showNotification(
                  `💬 ${senderName} in ${conversationTitle}`,
                  message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                  selectedConversation?.id
                )
              }
            }
          }
        }
        
        // Handle cross-conversation notifications
        if ((isCrossConversation || isNoConversationSelected) && message.conversationId && message.userId !== user?.id) {
          console.log('🌐 Handling cross-conversation notification for:', message.conversationId)
          
          // Update unread count for cross-conversation messages
          setUnreadCounts(prev => {
            const newCount = (prev[message.conversationId!] || 0) + 1
            console.log(`📊 Updating unread count for conversation ${message.conversationId}: ${newCount}`)
            return {
              ...prev,
              [message.conversationId!]: newCount
            }
          })
          
          // Show browser notification for cross-conversation messages
          if (notificationPermission === 'granted') {
            const senderName = message.user?.name || message.user?.email || 'Someone'
            const conversation = conversations.find(c => c.id === message.conversationId)
            const conversationTitle = conversation?.title || 'Chat'
            
            if (message.type === 'AI') {
              showNotification(
                `🤖 AI Response in ${conversationTitle}`,
                message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                message.conversationId
              )
            } else {
              showNotification(
                `💬 ${senderName} in ${conversationTitle}`,
                message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                message.conversationId
              )
            }
          }
        }
      }

      const handleAiThinking = (data: { isThinking: boolean }) => {
        console.log('AI thinking status:', data.isThinking)
        setAiThinking(data.isThinking)
      }

      const handleAiStreamingStart = (message: Message) => {
        console.log('AI streaming started:', message)
        setMessages(prev => [...prev, message])
      }

      const handleAiStreamingToken = (data: { messageId: string; token: string; fullContent: string }) => {
        console.log('AI streaming token received:', data.token)
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, content: data.fullContent }
            : msg
        ))
      }

      const handleAiStreamingComplete = (message: Message) => {
        console.log('AI streaming completed:', message)
        setMessages(prev => prev.map(msg => 
          msg.id === message.id || msg.id.includes('streaming-ai-') || msg.id.includes('regenerating-ai-')
            ? { ...message, isStreaming: false }
            : msg
        ))
        setAiThinking(false)
      }

      const handleAiError = (data: { error: string; conversationId: string }) => {
        console.error('AI error:', data.error)
        setAiThinking(false)
        // Remove any streaming messages on error
        setMessages(prev => prev.filter(msg => 
          !(msg.id.includes('streaming-ai-') || msg.id.includes('regenerating-ai-'))
        ))
        alert('AI response failed: ' + data.error)
      }

      const handleUserJoined = (data: { user: { id: string; name?: string; email: string }; joinedAt: string }) => {
        console.log('User joined:', data.user.name || data.user.email)
      }

      const handleUserLeft = (data: { user: { id: string; name?: string; email: string }; leftAt: string }) => {
        console.log('User left:', data.user.name || data.user.email)
      }

      const handleUserTyping = (data: { userId: string, userName: string, isTyping: boolean, conversationId?: string }) => {
        console.log('User typing event received:', data.userName, data.isTyping, 'in conversation:', data.conversationId)
        console.log('Current selected conversation:', selectedConversation?.id)
        
        // Only show typing indicators for the currently selected conversation
        if (!selectedConversation || data.conversationId !== selectedConversation.id) {
          console.log('Ignoring typing event from different conversation:', data.conversationId)
          return
        }
        
        setTypingUsers(prev => {
          if (data.isTyping) {
            if (!prev.includes(data.userName)) {
              return [...prev, data.userName]
            }
            return prev
          } else {
            return prev.filter(name => name !== data.userName)
          }
        })
      }

      const handleUserEditingMessage = (data: { messageId: string, userId: string, userName: string, isEditing: boolean, conversationId?: string }) => {
        console.log('User editing message:', data.userName, data.messageId, data.isEditing, 'in conversation:', data.conversationId)
        
        // Only show editing indicators for the currently selected conversation
        if (!selectedConversation || data.conversationId !== selectedConversation.id) {
          console.log('Ignoring message editing event from different conversation:', data.conversationId)
          return
        }
        
        setEditingUsers(prev => {
          const messageEditors = prev[data.messageId] || []
          
          if (data.isEditing) {
            if (!messageEditors.includes(data.userName)) {
              return {
                ...prev,
                [data.messageId]: [...messageEditors, data.userName]
              }
            }
            return prev
          } else {
            const updatedEditors = messageEditors.filter(name => name !== data.userName)
            if (updatedEditors.length === 0) {
              const { [data.messageId]: removed, ...rest } = prev
              return rest
            }
            return {
              ...prev,
              [data.messageId]: updatedEditors
            }
          }
        })
      }

      const handleMessageUpdated = (data: { message: Message }) => {
        console.log('Message updated via WebSocket:', data.message)
        setMessages(prev => prev.map(msg => 
          msg.id === data.message.id ? data.message : msg
        ))
      }

      const handleUserEditingConversationTitle = (data: { conversationId: string, userId: string, userName: string, isEditing: boolean }) => {
        console.log('User editing conversation title:', data.userName, data.conversationId, data.isEditing, 'in conversation:', data.conversationId)
        
        // Only show editing indicators for the currently selected conversation
        if (!selectedConversation || data.conversationId !== selectedConversation.id) {
          console.log('Ignoring conversation title editing event from different conversation:', data.conversationId)
          return
        }
        
        setEditingConversationUsers(prev => {
          if (data.isEditing) {
            if (!prev.includes(data.userName)) {
              return [...prev, data.userName]
            }
            return prev
          } else {
            return prev.filter(name => name !== data.userName)
          }
        })
      }

      const handleConversationTitleUpdated = (data: { conversation: Conversation }) => {
        console.log('Conversation title updated via WebSocket:', data.conversation)
        setConversations(prev => prev.map(conv => 
          conv.id === data.conversation.id ? data.conversation : conv
        ))
        
        if (selectedConversation?.id === data.conversation.id) {
          setSelectedConversation(data.conversation)
        }
      }

      const handleConversationDeleted = (data: { conversationId: string, conversation: Conversation }) => {
        console.log('Conversation deleted via WebSocket:', data.conversationId)
        setConversations(prev => prev.filter(conv => conv.id !== data.conversationId))
        
        if (selectedConversation?.id === data.conversationId) {
          setSelectedConversation(null)
        }
      }

      const handleUsersStatus = (data: { conversationId: string, onlineUsers: string[] }) => {
        console.log('Users status received:', data)
      }

      const handleUserStatusChanged = (data: { userId: string, isOnline: boolean, status: 'online' | 'away' | 'offline', conversationId: string }) => {
        console.log('🔄 User status changed:', data)
        setUserStatuses(prev => {
          const updated = {
            ...prev,
            [data.conversationId]: {
              ...prev[data.conversationId],
              [data.userId]: data.status
            }
          }
          return updated
        })
      }

      const handleUsersStatusDetailed = (data: { conversationId: string, usersStatus: { userId: string, status: 'online' | 'away' | 'offline' }[] }) => {
        console.log('🔄 Users detailed status received:', data)
        const statusMap: {[userId: string]: 'online' | 'away' | 'offline'} = {}
        data.usersStatus.forEach(userStatus => {
          statusMap[userStatus.userId] = userStatus.status
        })
        
        setUserStatuses(prev => {
          const updated = {
            ...prev,
            [data.conversationId]: statusMap
          }
          return updated
        })
      }

      const handleError = (error: unknown) => {
        console.error('WebSocket error:', error)
      }

      const handleConversationMessages = (data: { messages: Message[] }) => {
        console.log('Received conversation messages:', data.messages.length)
        setMessages(data.messages)
      }

      // Register all event listeners with the unified message handler
      const handleNewMessage = (message: Message) => {
        console.log('🌐 Frontend received new-message via WebSocket:', JSON.stringify(message, null, 2))
        console.log('🌐 Socket connected:', socket.connected)
        console.log('🌐 Socket ID:', socket.id)
        console.log('🌐 Message type in handleNewMessage:', typeof message)
        console.log('🌐 Message conversationId in handleNewMessage:', message.conversationId)
        console.log('🌐 Current selected conversation ID:', selectedConversation?.id)
        console.log('🌐 Message conversationId matches selected conversation:', message.conversationId === selectedConversation?.id)
        handleUnifiedMessage(message)
      }
      
      socket.on('new-message', handleNewMessage)
      socket.on('ai-thinking', handleAiThinking)
      socket.on('ai-streaming-start', handleAiStreamingStart)
      socket.on('ai-streaming-token', handleAiStreamingToken)
      socket.on('ai-streaming-complete', handleAiStreamingComplete)
      socket.on('ai-error', handleAiError)
      socket.on('user-joined', handleUserJoined)
      socket.on('user-left', handleUserLeft)
      socket.on('user-typing', handleUserTyping)
      socket.on('user-editing-message', handleUserEditingMessage)
      socket.on('message-updated', handleMessageUpdated)
      socket.on('user-editing-conversation-title', handleUserEditingConversationTitle)
      socket.on('conversation-title-updated', handleConversationTitleUpdated)
      socket.on('conversation-deleted', handleConversationDeleted)
      socket.on('users-status', handleUsersStatus)
      socket.on('user-status-changed', handleUserStatusChanged)
      socket.on('users-status-detailed', handleUsersStatusDetailed)
      socket.on('error', handleError)
      socket.on('conversation-messages', handleConversationMessages)
      
      // Listen for join confirmation
      socket.on('user-joined-conversation', (data) => {
        console.log('🌐 Successfully joined conversation:', data.conversationId)
      })

      socket.on('connect', () => {
        console.log('🌐 WebSocket connected successfully')
        console.log('🌐 Socket ID:', socket.id)
        console.log('🌐 Socket connected:', socket.connected)
      })

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
      })

      return () => {
        console.log('🌐 Cleaning up unified WebSocket listeners')
        socket.off('new-message', handleNewMessage)
        socket.off('ai-thinking', handleAiThinking)
        socket.off('ai-streaming-start', handleAiStreamingStart)
        socket.off('ai-streaming-token', handleAiStreamingToken)
        socket.off('ai-streaming-complete', handleAiStreamingComplete)
        socket.off('ai-error', handleAiError)
        socket.off('user-joined', handleUserJoined)
        socket.off('user-left', handleUserLeft)
        socket.off('user-typing', handleUserTyping)
        socket.off('user-editing-message', handleUserEditingMessage)
        socket.off('message-updated', handleMessageUpdated)
        socket.off('user-editing-conversation-title', handleUserEditingConversationTitle)
        socket.off('conversation-title-updated', handleConversationTitleUpdated)
        socket.off('conversation-deleted', handleConversationDeleted)
        socket.off('users-status', handleUsersStatus)
        socket.off('user-status-changed', handleUserStatusChanged)
        socket.off('users-status-detailed', handleUsersStatusDetailed)
        socket.off('error', handleError)
        socket.off('conversation-messages', handleConversationMessages)
        socket.off('user-joined-conversation')
        socket.off('connect')
        socket.off('disconnect')
      }
    }
  }, [socket, isConnected, user, selectedConversation, conversations, notificationPermission])

  // Enhanced browser visibility and connection tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden
      console.log(`📱 Tab visibility changed: ${isHidden ? 'HIDDEN' : 'VISIBLE'}`)
      console.log(`📱 Socket connected: ${socket?.connected}`)
      console.log(`📱 Socket ID: ${socket?.id}`)
      
      // Log current state for debugging
      if (socket && isConnected) {
        console.log(`📱 Real-time notifications should ${isHidden ? 'WORK' : 'be for current conversation only'}`)
      }
    }

    const handleFocus = () => {
      console.log('📱 Window FOCUSED')
      if (socket && !socket.connected) {
        console.log('📱 Reconnecting socket after focus...')
        socket.connect()
      }
    }

    const handleBlur = () => {
      console.log('📱 Window BLURRED')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Log initial state
    console.log(`📱 Initial tab state: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [socket, isConnected])

  // Initialize notifications and sound
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission)
        
        // Show a test notification on first load if permission is granted
        if (permission === 'granted') {
          setTimeout(() => {
            const notification = new Notification('🎉 Notifications Enabled!', {
              body: 'You will now receive real-time chat notifications with sound.',
              icon: '/favicon.ico',
              tag: 'test-notification'
            })
            
            setTimeout(() => notification.close(), 3000)
          }, 2000) // Show after 2 seconds to give user time to see the page
        }
      })
    }
  }, [])

  // Notification helper functions
  const playNotificationSound = () => {
    try {
      // Create a more pleasant notification sound using Web Audio API
      // Support both standard and prefixed constructors without using `any`
      interface WindowWithAudioContext extends Window {
        webkitAudioContext?: typeof AudioContext;
      }
      const win = window as WindowWithAudioContext;
      const AudioCtor = (win as any).AudioContext || win.webkitAudioContext;
      if (!AudioCtor) {
        throw new Error('AudioContext is not supported');
      }
      const audioContext = new AudioCtor();
      
      // Create two-tone notification sound (like WhatsApp/Teams)
      const createTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(frequency, startTime)
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }
      
      // Play a pleasant two-tone notification
      const now = audioContext.currentTime
      createTone(800, now, 0.15)        // First tone
      createTone(600, now + 0.2, 0.15)  // Second tone (slightly delayed)
      
    } catch (e) {
      console.log('Audio play failed:', e)
      
      // Fallback: try to play a system beep
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+rYs2ERBSyPz+rdfA==')
        audio.volume = 0.3
        audio.play().catch(() => {
          // If all else fails, try the system beep
          console.log('Playing system beep')
        })
      } catch (fallbackError) {
        console.log('Fallback audio also failed')
      }
    }
    
    // Flash the browser tab title for visual feedback
    const originalTitle = document.title
    let flashCount = 0
    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? '💬 New Message!' : originalTitle
      flashCount++
      if (flashCount >= 6) { // Flash 3 times
        clearInterval(flashInterval)
        document.title = originalTitle
      }
    }, 500)
  }

  const showNotification = (title: string, body: string, conversationId?: string) => {
    // Show browser notification only if page is hidden or user is in different conversation
    const shouldShowBrowserNotification = document.hidden || (conversationId && selectedConversation?.id !== conversationId)
    
    if (shouldShowBrowserNotification && notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chat-message'
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
        
        // Switch to the conversation if provided
        if (conversationId) {
          const conversation = conversations.find(c => c.id === conversationId)
          if (conversation) {
            setSelectedConversation(conversation)
          }
        }
      }

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)
    }
  }

  const loadConversations = async () => {
    try {
      console.log('Loading conversations...')
      const data = await conversationsApi.getConversations()
      console.log('Conversations loaded:', data)
      setConversations(data)
    } catch (error: unknown) {
      console.error('Failed to load conversations:', error)
      // Cast to type with optional response structure to safely access status
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        console.log('Unauthorized - redirecting to login')
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const messages = await messagesApi.getMessages(conversationId)
      setMessages(messages)
    } catch (error: unknown) {
      console.error('Failed to load messages:', error)
    }
  }

  const createNewConversation = async () => {
    if (creating) return
    
    setCreating(true)
    try {
      console.log('Creating new conversation...')
      const newConversation = await conversationsApi.createConversation('New Chat')
      console.log('New conversation created:', newConversation)
      setConversations(prev => [newConversation, ...prev])
      setSelectedConversation(newConversation)
    } catch (error: unknown) {
      console.error('Failed to create conversation:', error)
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        console.log('Unauthorized - redirecting to login')
        logout()
      } else {
        alert('Failed to create conversation. Please try again.')
      }
    } finally {
      setCreating(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return

    setSendingMessage(true)
    setAiThinking(false)
    const messageContent = newMessage.trim()
    
    try {
      setNewMessage('')

      // Clear typing indicator
      if (socket) {
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          isTyping: false
        })
      }

      // Create temporary message for immediate display
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        type: 'USER',
        userId: user?.id,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
        } : undefined,
        createdAt: new Date().toISOString(),
      }

      // Add message immediately to UI for sender
      setMessages(prev => [...prev, tempMessage])

      // Use WebSocket for AI streaming - this will broadcast to all users in real-time
      if (socket) {
        console.log('🌐 Sending message via WebSocket:', {
          conversationId: selectedConversation.id,
          content: messageContent,
          messageId: tempMessage.id
        })
        socket.emit('send-message-with-ai', {
          conversationId: selectedConversation.id,
          content: messageContent,
          messageId: tempMessage.id
        })
      } else {
        // Fallback to API if WebSocket is not available
        console.warn('WebSocket not available, falling back to API')
        messagesApi.sendMessageWithAI(selectedConversation.id, messageContent, (data: any) => {
          // Handle SSE fallback (existing logic)
          switch (data.type) {
            case 'user_message':
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessage.id ? (data.message as Message) : msg
              ))
              break
            case 'ai_start':
              setAiThinking(true)
              break
            case 'ai_token':
              // Handle token streaming
              break
            case 'ai_response':
              setAiThinking(false)
              break
            case 'ai_error':
              setAiThinking(false)
              alert('AI response failed: ' + data.error)
              break
            case 'complete':
              setAiThinking(false)
              break
          }
        })
      }

    } catch (error: unknown) {
      console.error('Failed to send message:', error)
      setNewMessage(messageContent) // Restore message on error
    } finally {
      setSendingMessage(false)
    }
  }

  const startEditMessage = (message: Message) => {
    if (message.userId === user?.id && message.type === 'USER') {
      setEditingMessageId(message.id)
      setEditContent(message.content)
      
      // Broadcast editing status to other users
      if (socket && selectedConversation) {
        socket.emit('editing-message', {
          conversationId: selectedConversation.id,
          messageId: message.id,
          isEditing: true
        })
      }
    }
  }

  const saveEditMessage = async () => {
    if (!editingMessageId || !editContent.trim()) return

    try {
      const updatedMessage = await messagesApi.updateMessage(editingMessageId, editContent.trim())
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessageId ? updatedMessage : msg
      ))
      
      // Stop broadcasting editing status
      if (socket && selectedConversation) {
        socket.emit('editing-message', {
          conversationId: selectedConversation.id,
          messageId: editingMessageId,
          isEditing: false
        })
      }
      
      setEditingMessageId(null)
      setEditContent('')
      
      // Check if this was the last user message before an AI response
      const messageIndex = messages.findIndex(msg => msg.id === editingMessageId)
      const nextMessage = messages[messageIndex + 1]
      
      // If next message is an AI response, regenerate it with new context
      if (nextMessage && nextMessage.type === 'AI' && selectedConversation) {
        console.log('Regenerating AI response after message edit...')
        setAiThinking(true)
        
        try {
          // Use WebSocket to regenerate AI response
          if (socket) {
            socket.emit('send-message-with-ai', {
              conversationId: selectedConversation.id,
              content: editContent.trim(),
              messageId: `edit-${Date.now()}`
            })
          } else {
            // Fallback to API if WebSocket is not available
            console.warn('WebSocket not available, falling back to API for regeneration')
            messagesApi.sendMessageWithAI(selectedConversation.id, editContent.trim(), (data: any) => {
              // Handle SSE fallback (existing logic)
              switch (data.type) {
                case 'ai_start':
                  setAiThinking(true)
                  break
                case 'ai_token':
                  // Handle token streaming
                  break
                case 'ai_response':
                  setAiThinking(false)
                  break
                case 'ai_error':
                  setAiThinking(false)
                  console.error('AI regeneration failed:', data.error)
                  break
                case 'complete':
                  setAiThinking(false)
                  break
              }
            })
          }
        } catch (error: unknown) {
          console.error('Failed to regenerate AI response:', error)
          setAiThinking(false)
        }
      }
      
    } catch (error: unknown) {
      console.error('Failed to update message:', error)
      alert('Failed to update message')
    }
  }

  const cancelEditMessage = () => {
    if (editingMessageId && socket && selectedConversation) {
      // Stop broadcasting editing status
      socket.emit('editing-message', {
        conversationId: selectedConversation.id,
        messageId: editingMessageId,
        isEditing: false
      })
    }
    
    setEditingMessageId(null)
    setEditContent('')
  }

  const sendInvitation = async () => {
    if (!inviteEmail.trim() || !selectedConversation) return

    try {
      await invitationsApi.sendInvitation(inviteEmail.trim(), selectedConversation.id)
      alert('Invitation sent successfully!')
      setInviteEmail('')
      setShowInviteModal(false)
    } catch (error: unknown) {
      console.error('Failed to send invitation:', error)
      const err = error as { response?: { data?: { message?: string } } };
      alert(err?.response?.data?.message || 'Failed to send invitation')
    }
  }

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setEditingConversationUsers([]) // Clear editing indicators when switching conversations
    
    // Clear unread count for this conversation
    setUnreadCounts(prev => ({
      ...prev,
      [conversation.id]: 0
    }))
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const loadPendingInvitations = async () => {
    try {
      const invitations = await invitationsApi.getInvitations()
      setPendingInvitations(invitations.length)
    } catch (error: unknown) {
      console.error('Failed to load pending invitations:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewMessage(value)

    if (socket && selectedConversation) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      // Emit typing start
      if (value.trim()) {
        console.log('🌐 Emitting typing start:', {
          conversationId: selectedConversation.id,
          isTyping: true
        })
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          isTyping: true
        })

        // Set timeout to stop typing after 1 second of no input
        const timeout = setTimeout(() => {
          console.log('🌐 Emitting typing stop:', {
            conversationId: selectedConversation.id,
            isTyping: false
          })
          socket.emit('typing', {
            conversationId: selectedConversation.id,
            isTyping: false
          })
        }, 1000)

        setTypingTimeout(timeout as unknown as number)
      } else {
        // Empty input, stop typing immediately
        socket.emit('typing', {
          conversationId: selectedConversation.id,
          isTyping: false
        })
      }
    }
  }

  const startEditConversation = (conversation: Conversation) => {
    setEditingConversationId(conversation.id)
    setEditConversationTitle(conversation.title || '')
    
    // Broadcast editing status to other users
    if (socket && selectedConversation) {
      socket.emit('editing-conversation-title', {
        conversationId: conversation.id,
        isEditing: true
      })
    }
  }

  const saveConversationTitle = async () => {
    if (!editingConversationId || !editConversationTitle.trim()) return

    try {
      const updatedConversation = await conversationsApi.updateConversation(
        editingConversationId,
        editConversationTitle.trim()
      )
      
      // Update the conversation in the list
      setConversations(prev => prev.map(conv => 
        conv.id === editingConversationId ? updatedConversation : conv
      ))
      
      // Update selected conversation if it's the one being edited
      if (selectedConversation?.id === editingConversationId) {
        setSelectedConversation(updatedConversation)
      }
      
      // Stop broadcasting editing status
      if (socket) {
        socket.emit('editing-conversation-title', {
          conversationId: editingConversationId,
          isEditing: false
        })
      }
      
      setEditingConversationId(null)
      setEditConversationTitle('')
    } catch (error: unknown) {
      console.error('Failed to update conversation title:', error)
      alert('Failed to update conversation title')
    }
  }

  const cancelEditConversation = () => {
    if (editingConversationId && socket) {
      // Stop broadcasting editing status
      socket.emit('editing-conversation-title', {
        conversationId: editingConversationId,
        isEditing: false
      })
    }
    
    setEditingConversationId(null)
    setEditConversationTitle('')
  }

  const startDeleteConversation = (conversation: Conversation) => {
    setConversationToDelete(conversation)
    setShowDeleteModal(true)
  }

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return

    try {
      await conversationsApi.deleteConversation(conversationToDelete.id)
      
      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.id !== conversationToDelete.id))
      
      // Clear selected conversation if it was deleted
      if (selectedConversation?.id === conversationToDelete.id) {
        setSelectedConversation(null)
      }
      
      setShowDeleteModal(false)
      setConversationToDelete(null)
    } catch (error: unknown) {
      console.error('Failed to delete conversation:', error)
      alert('Failed to delete conversation')
    }
  }

  const cancelDeleteConversation = () => {
    setShowDeleteModal(false)
    setConversationToDelete(null)
  }

  const getUserStatus = (userId: string): 'online' | 'away' | 'offline' => {
    if (!selectedConversation) return 'offline'
    const conversationStatuses = userStatuses[selectedConversation.id] || {}
    const status = conversationStatuses[userId] || 'offline'
    console.log(`🎯 Getting status for user ${userId} in conversation ${selectedConversation.id}: ${status}`)
    console.log(`🎯 All statuses for conversation:`, conversationStatuses)
    return status
  }

  const getStatusColor = (status: 'online' | 'away' | 'offline') => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getStatusTextColor = (status: 'online' | 'away' | 'offline') => {
    switch (status) {
      case 'online': return 'text-green-600'
      case 'away': return 'text-yellow-600'
      case 'offline': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  // Calculate total unread messages
  const totalUnreadCount = Object.values(unreadCounts).reduce((total, count) => total + count, 0)

  const loadUnreadCounts = async () => {
    try {
      const counts = await messagesApi.getUnreadCounts()
      setUnreadCounts(counts)
    } catch (error: unknown) {
      console.error('Failed to load unread counts:', error)
    }
  }

  const markConversationAsRead = async (conversationId: string) => {
    try {
      await messagesApi.markConversationAsRead(conversationId)
      setUnreadCounts(prev => ({
        ...prev,
        [conversationId]: 0
      }))
    } catch (error: unknown) {
      console.error('Failed to mark conversation as read:', error)
    }
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
              {/* Total unread count badge */}
              {totalUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center font-medium">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              
              {/* Notification Permission Indicator */}
              <div 
                className={`w-2 h-2 rounded-full ${
                  notificationPermission === 'granted' ? 'bg-blue-500' : 
                  notificationPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                }`} 
                title={`Notifications: ${
                  notificationPermission === 'granted' ? 'Enabled' : 
                  notificationPermission === 'denied' ? 'Blocked' : 'Not requested'
                }`}
              />
              
              {/* Notification permission button */}
              {notificationPermission !== 'granted' && (
                <button
                  onClick={async () => {
                    if ('Notification' in window) {
                      const permission = await Notification.requestPermission()
                      setNotificationPermission(permission)
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Enable notifications"
                >
                  🔔
                </button>
              )}
              
              {/* Invitations Badge */}
              <button
                onClick={() => navigate('/invitations')}
                className="relative p-1 text-gray-500 hover:text-gray-700"
                title="View invitations"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-5v3H5V8a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
                {pendingInvitations > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {pendingInvitations}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => {
                  // Emit logout status before logging out
                  if (socket && user) {
                    socket.emit('user-activity', { type: 'logout' })
                  }
                  logout()
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {user?.name || user?.email}
          </p>
        </div>

        <div className="p-4">
          <button
            onClick={createNewConversation}
            disabled={creating}
            className={`btn btn-primary w-full ${creating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {creating ? 'Creating...' : '+ New Chat'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No conversations yet. Create your first chat!
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group p-3 rounded-lg transition-colors relative ${
                    selectedConversation?.id === conversation.id
                      ? 'bg-primary-100 border-primary-200'
                      : unreadCounts[conversation.id] > 0
                      ? 'hover:bg-red-50 bg-red-50 border-l-4 border-red-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {editingConversationId === conversation.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editConversationTitle}
                        onChange={(e) => setEditConversationTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveConversationTitle()
                          } else if (e.key === 'Escape') {
                            cancelEditConversation()
                          }
                        }}
                        className="w-full p-1 text-sm border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Enter chat title..."
                        autoFocus
                      />
                      <div className="flex space-x-1">
                        <button
                          onClick={saveConversationTitle}
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditConversation}
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal mode
                    <>
                      {/* Show editing indicator for other users */}
                      {editingConversationUsers.length > 0 && selectedConversation?.id === conversation.id && (
                        <div className="mb-2 flex items-center space-x-2 text-xs text-orange-600">
                          <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="font-medium">
                            {editingConversationUsers.length === 1 
                              ? `${editingConversationUsers[0]} is editing title...`
                              : `${editingConversationUsers.join(', ')} are editing title...`
                            }
                          </span>
                        </div>
                      )}
                      
                      <div
                        onClick={() => selectConversation(conversation)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">
                            {conversation.title || 'Untitled Chat'}
                          </h3>
                          {/* Unread count badge */}
                          {unreadCounts[conversation.id] > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center font-medium">
                              {unreadCounts[conversation.id] > 99 ? '99+' : unreadCounts[conversation.id]}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {conversation.participants?.length || 0} participants
                        </p>
                      </div>
                      
                      {/* Edit/Delete buttons (shown on hover) */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditConversation(conversation)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit title"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startDeleteConversation(conversation)
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete chat"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedConversation.title || 'Untitled Chat'}
                </h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{selectedConversation.participants?.length || 0} participants</span>
                  {selectedConversation.participants && selectedConversation.participants.length > 0 && (
                    <div className="flex items-center space-x-3 ml-4">
                      {selectedConversation.participants.map((participant: Participant) => (
                        <div key={participant.user.id} className="flex items-center space-x-1.5">
                          <div className={`w-2 h-2 rounded-full ${
                            getStatusColor(getUserStatus(participant.user.id))
                          }`} />
                          <span className={`text-xs ${
                            getStatusTextColor(getUserStatus(participant.user.id))
                          }`}>
                            {participant.user.name || participant.user.email}
                            {participant.user.id === user?.id && ' (You)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="btn btn-secondary text-sm"
              >
                Invite to Collaborate
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.userId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-2xl lg:max-w-3xl ${message.userId === user?.id ? 'text-right' : 'text-left'}`}>
                      {/* User Name Label */}
                      <div className={`text-xs font-medium mb-2 px-2 ${
                        message.type === 'AI' 
                          ? 'text-purple-600'
                          : message.userId === user?.id
                          ? 'text-blue-600'
                          : 'text-gray-600'
                      }`}>
                        {message.type === 'AI' 
                          ? (
                            <span className="flex items-center space-x-2">
                              <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <span>AI Assistant</span>
                            </span>
                          )
                          : (
                            <span className="flex items-center space-x-2">
                              <span>
                                {message.userId === user?.id
                                  ? `You (${user?.name || user?.email})`
                                  : (message.user?.name || message.user?.email || 'Unknown User')
                                }
                              </span>
                              {message.userId && message.userId !== user?.id && (
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  getStatusColor(getUserStatus(message.userId))
                                }`} />
                              )}
                            </span>
                          )
                        }
                      </div>
                      
                      <div
                        className={`px-6 py-4 rounded-2xl shadow-sm relative group transition-all duration-200 hover:shadow-md ${
                          message.type === 'AI'
                            ? 'bg-white border border-purple-100 text-gray-800'
                            : message.userId === user?.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        {editingMessageId === message.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-3 text-sm border border-gray-300 rounded-lg resize-none text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={3}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={saveEditMessage}
                                className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditMessage}
                                className="text-xs bg-gray-500 text-white px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Show editing indicator for other users */}
                            {editingUsers[message.id] && editingUsers[message.id].length > 0 && (
                              <div className="mb-2 flex items-center space-x-2 text-xs text-orange-600">
                                <div className="flex space-x-1">
                                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="font-medium">
                                  {editingUsers[message.id].length === 1 
                                    ? `${editingUsers[message.id][0]} is editing this message...`
                                    : `${editingUsers[message.id].join(', ')} are editing this message...`
                                  }
                                </span>
                              </div>
                            )}
                            
                            <div className="text-sm leading-relaxed">
                              {message.type === 'AI' ? (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      // Enhanced styling for all markdown elements
                                      p: ({children}) => <p className="mb-3 last:mb-0 text-gray-700 leading-relaxed">{children}</p>,
                                      strong: ({children}) => <strong className="font-semibold text-purple-700 bg-purple-50 px-1 py-0.5 rounded">{children}</strong>,
                                      em: ({children}) => <em className="italic text-purple-600">{children}</em>,
                                      
                                      // Lists
                                      ol: ({children}) => <ol className="list-decimal list-outside space-y-2 ml-6 my-4">{children}</ol>,
                                      ul: ({children}) => <ul className="list-disc list-outside space-y-2 ml-6 my-4">{children}</ul>,
                                      li: ({children}) => <li className="leading-relaxed text-gray-700 pl-1">{children}</li>,
                                      
                                      // Headers
                                      h1: ({children}) => <h1 className="text-xl font-bold mb-3 text-purple-800 border-b border-purple-200 pb-2">{children}</h1>,
                                      h2: ({children}) => <h2 className="text-lg font-semibold mb-3 text-purple-700">{children}</h2>,
                                      h3: ({children}) => <h3 className="text-md font-semibold mb-2 text-purple-600">{children}</h3>,
                                      h4: ({children}) => <h4 className="text-sm font-semibold mb-2 text-purple-500">{children}</h4>,
                                      h5: ({children}) => <h5 className="text-sm font-medium mb-1 text-purple-400">{children}</h5>,
                                      h6: ({children}) => <h6 className="text-xs font-medium mb-1 text-purple-400">{children}</h6>,
                                      
                                      // Code
                                      code: ({children, className}) => {
                                        const isInline = !className;
                                        return isInline ? (
                                          <code className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-mono">{children}</code>
                                        ) : (
                                          <code className="block bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto my-3">{children}</code>
                                        );
                                      },
                                      pre: ({children}) => <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto my-3">{children}</pre>,
                                      
                                      // Tables - Full styling for professional appearance
                                      table: ({children}) => (
                                        <div className="overflow-x-auto my-4">
                                          <table className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg">
                                            {children}
                                          </table>
                                        </div>
                                      ),
                                      thead: ({children}) => <thead className="bg-purple-50">{children}</thead>,
                                      tbody: ({children}) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
                                      tr: ({children}) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
                                      th: ({children}) => (
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider border-b border-purple-200">
                                          {children}
                                        </th>
                                      ),
                                      td: ({children}) => (
                                        <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                                          {children}
                                        </td>
                                      ),
                                      
                                      // Quotes
                                      blockquote: ({children}) => (
                                        <blockquote className="border-l-4 border-purple-300 pl-4 py-2 bg-purple-50 italic text-purple-700 my-3 rounded-r">
                                          {children}
                                        </blockquote>
                                      ),
                                      
                                      // Links
                                      a: ({children, href}) => (
                                        <a 
                                          href={href} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                                        >
                                          {children}
                                        </a>
                                      ),
                                      
                                      // Horizontal Rule
                                      hr: () => <hr className="my-4 border-gray-300" />,
                                      
                                      // Task Lists (GFM)
                                      input: ({type, checked, disabled}) => {
                                        if (type === 'checkbox') {
                                          return (
                                            <input
                                              type="checkbox"
                                              checked={checked || false}
                                              disabled={disabled || true}
                                              className="mr-2 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                            />
                                          );
                                        }
                                        return <input type={type} />;
                                      },
                                      
                                      // Strikethrough (GFM)
                                      del: ({children}) => <del className="line-through text-gray-500">{children}</del>,
                                    }}
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <span className="text-current">{message.content}</span>
                              )}
                            </div>
                            <div className={`text-xs mt-3 flex justify-between items-center ${
                              message.type === 'AI'
                                ? 'text-gray-500'
                                : message.userId === user?.id
                                ? 'text-blue-100'
                                : 'text-gray-500'
                            }`}>
                              <span>{formatTime(message.createdAt)}</span>
                              {message.type === 'AI' && (
                                <span className="text-purple-400 text-xs font-medium">AI</span>
                              )}
                            </div>
                            
                            {/* Edit button for own messages */}
                            {message.userId === user?.id && message.type === 'USER' && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditMessage(message)}
                                  className="p-1.5 bg-white bg-opacity-20 backdrop-blur-sm text-white hover:bg-opacity-30 transition-all duration-200 rounded-lg shadow-sm"
                                  title="Edit message"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {aiThinking && (
                  <div className="flex justify-start">
                    <div className="max-w-2xl lg:max-w-3xl text-left">
                      <div className="text-xs font-medium mb-2 px-2 text-purple-600">
                        <span className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                          </svg>
                          <span>AI Assistant</span>
                        </span>
                      </div>
                      <div className="bg-white border border-purple-100 px-6 py-4 rounded-2xl shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-purple-600 font-medium">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Typing indicators for other users */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-2xl lg:max-w-3xl text-left">
                      <div className="text-xs font-medium mb-2 px-2 text-gray-600">
                        {typingUsers.length === 1 
                          ? `${typingUsers[0]} is typing...`
                          : `${typingUsers.join(', ')} are typing...`
                        }
                      </div>
                      <div className="bg-gray-100 text-gray-700 px-6 py-4 rounded-2xl shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-600 font-medium">Typing...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-gray-200 bg-white">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={sendMessage} className="flex space-x-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  >
                    {sendingMessage ? (
                      <span className="flex items-center space-x-2">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Sending...</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-2">
                        <span>Send</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Welcome to Collaborative AI Chat
              </h2>
              <p className="text-gray-600">
                Select a conversation or create a new one to start chatting with AI and collaborators.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Invite to Collaborate</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the email address of the person you want to invite to this conversation.
            </p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full input mb-4"
            />
            <div className="flex space-x-2 justify-end">
              <button
                onClick={() => setShowInviteModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={sendInvitation}
                disabled={!inviteEmail.trim()}
                className="btn btn-primary"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && conversationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Conversation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete "<strong>{conversationToDelete.title || 'Untitled Chat'}</strong>"? 
              This action cannot be undone and will delete all messages in this conversation.
            </p>
            <div className="flex space-x-2 justify-end">
              <button
                onClick={cancelDeleteConversation}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteConversation}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 