import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

interface User {
  id: string
  email: string
  name?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Add small delay to ensure localStorage is ready
    const timer = setTimeout(() => {
      checkAuth()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const checkAuth = async () => {
    try {
      const access_token = localStorage.getItem('access_token')
      if (access_token) {
        authApi.setToken(access_token)
        const userData = await authApi.getProfile()
        setUser(userData)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('access_token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password)
      
      // Ensure we have a valid access_token
      if (!data.access_token) {
        throw new Error('No access token received')
      }
      
      // Set access_token first
      localStorage.setItem('access_token', data.access_token)
      authApi.setToken(data.access_token)
      
      // Verify access_token was set correctly
      const savedToken = localStorage.getItem('access_token')
      console.log('🔐 Access token saved:', !!savedToken)
      console.log('🔐 Access token preview:', savedToken ? savedToken.substring(0, 20) + '...' : 'null')
      
      // Only set user if access_token is properly saved
      if (savedToken === data.access_token) {
        setUser(data.user)
      } else {
        throw new Error('Failed to save access token properly')
      }
    } catch (error) {
      console.error('Login error:', error)
      // Clean up on login failure
      localStorage.removeItem('access_token')
      authApi.setToken('')
      setUser(null)
      throw error
    }
  }

  const register = async (email: string, password: string, name?: string) => {
    try {
      const data = await authApi.register(email, password, name)
      
      // Ensure we have a valid access_token
      if (!data.access_token) {
        throw new Error('No access token received')
      }
      
      // Set access_token first
      localStorage.setItem('access_token', data.access_token)
      authApi.setToken(data.access_token)
      
      // Verify access_token was set correctly
      const savedToken = localStorage.getItem('access_token')
      console.log('🔐 Access token saved:', !!savedToken)
      console.log('🔐 Access token preview:', savedToken ? savedToken.substring(0, 20) + '...' : 'null')
      
      // Only set user if access_token is properly saved
      if (savedToken === data.access_token) {
        setUser(data.user)
      } else {
        throw new Error('Failed to save access token properly')
      }
    } catch (error) {
      console.error('Register error:', error)
      // Clean up on register failure
      localStorage.removeItem('access_token')
      authApi.setToken('')
      setUser(null)
      throw error
    }
  }

  const logout = () => {
    // Clean up and logout
    localStorage.removeItem('access_token')
    authApi.setToken('')
    setUser(null)
    
    // Note: Socket logout handling is now done in SocketContext when user becomes null
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 