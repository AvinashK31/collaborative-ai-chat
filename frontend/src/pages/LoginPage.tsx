import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

/**
 * LoginPage component for user authentication.
 * 
 * This component provides a form for users to log in with their email and password.
 * It handles form submission, loading states, and error handling with toast notifications.
 * 
 * Features:
 * - Email and password input validation
 * - Loading state during authentication
 * - Error handling with user-friendly messages
 * - Link to registration page for new users
 * 
 * @example
 * ```tsx
 * <LoginPage />
 * ```
 */
export default function LoginPage() {
  /** Current email input value */
  const [email, setEmail] = useState('')
  /** Current password input value */
  const [password, setPassword] = useState('')
  /** Loading state during form submission */
  const [loading, setLoading] = useState(false)
  /** Authentication context hook */
  const { login } = useAuth()

  /**
   * Handles form submission for user login.
   * 
   * @param e - Form submission event
   * @returns Promise<void>
   * 
   * @example
   * ```tsx
   * <form onSubmit={handleSubmit}>
   *   <input type="email" />
   *   <input type="password" />
   *   <button type="submit">Login</button>
   * </form>
   * ```
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (error: unknown) {
      // Cast to expected AxiosError shape
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input mt-1"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input mt-1"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex justify-center items-center"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 