import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const userIdRef = useRef<string | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    // Only create socket if user exists, no socket exists, and user changed
    if (user?.id && !socketRef.current && userIdRef.current !== user.id) {
      const access_token = localStorage.getItem('access_token')
      const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:9000'
      
      console.log('🔄 Creating new WebSocket connection...')
      console.log('Socket URL:', socketUrl)
      console.log('User ID:', user.id)
      console.log('Access token exists:', !!access_token)
      console.log('Access token preview:', access_token ? access_token.substring(0, 20) + '...' : 'null')
      
      // Don't create socket if no valid access_token
      if (!access_token || access_token === 'undefined' || access_token === 'null') {
        console.log('❌ No valid access token available, retrying in 1 second...')
        
        // Retry after a short delay in case access_token is being set
        retryTimeoutRef.current = setTimeout(() => {
          if (user?.id && !socketRef.current) {
            console.log('🔄 Retrying socket connection...')
            // Trigger re-render to try again
            setSocket(null)
          }
        }, 1000) as unknown as number
        return
      }
      
      const newSocket = io(socketUrl, {
        auth: {
          token: access_token,
          user,
        },
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 30000,
        transports: ['websocket', 'polling'],
        forceNew: true,
        upgrade: true,
        rememberUpgrade: true,
      })

      newSocket.on('connect', () => {
        setIsConnected(true)
        console.log('✅ WebSocket Connected successfully!')
        console.log('Socket ID:', newSocket.id)
      })

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false)
        console.log('❌ WebSocket Disconnected:', reason)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ WebSocket Connection Error:', error)
        console.error('Error message:', error.message)
        setIsConnected(false)
        
        // If it's an auth error, clear the access_token and force re-login
        if (error.message?.includes('jwt') || error.message?.includes('token') || error.message?.includes('auth')) {
          console.log('🔐 Authentication error, clearing access token and forcing re-login')
          localStorage.removeItem('access_token')
          window.location.href = '/login'
        }
      })

      newSocket.on('error', (error) => {
        console.error('❌ WebSocket Error:', error)
      })

      // Store in ref and state
      socketRef.current = newSocket
      userIdRef.current = user.id
      setSocket(newSocket)
      
    } else if (!user && socketRef.current) {
      // User logged out, emit logout status before cleaning up
      console.log('👤 User logged out, emitting logout status and cleaning up WebSocket')
      
      // Clear any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      
      // Emit logout status before disconnecting
      if (socketRef.current.connected) {
        socketRef.current.emit('user-activity', { type: 'logout' })
        
        // Wait a bit for the logout event to be sent, then disconnect
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.removeAllListeners()
            socketRef.current.close()
          }
          socketRef.current = null
          userIdRef.current = null
          setSocket(null)
          setIsConnected(false)
        }, 100)
      } else {
        // Socket not connected, clean up immediately
        socketRef.current.removeAllListeners()
        socketRef.current.close()
        socketRef.current = null
        userIdRef.current = null
        setSocket(null)
        setIsConnected(false)
      }
    }

    // Cleanup function
    return () => {
      // Clear any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      
      // Only cleanup on unmount, not on re-renders
      if (!user) {
        console.log('🧹 Component unmounting, cleaning up WebSocket')
        if (socketRef.current) {
          socketRef.current.removeAllListeners()
          socketRef.current.close()
          socketRef.current = null
        }
        userIdRef.current = null
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [user?.id, socket]) // Add socket to dependencies to trigger retry

  const disconnect = () => {
    console.log('🔌 Manual disconnect requested')
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.close()
      socketRef.current = null
    }
    userIdRef.current = null
    setSocket(null)
    setIsConnected(false)
  }

  const value: SocketContextType = {
    socket,
    isConnected,
    disconnect,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
} 
