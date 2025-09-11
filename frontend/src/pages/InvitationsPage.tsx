import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { invitationsApi } from '../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface Invitation {
  id: string
  email: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
  sender: {
    id: string
    name?: string
    email: string
  }
  conversation: {
    id: string
    title?: string
  }
}

export default function InvitationsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
    
    // Handle URL parameters for direct invitation actions
    const invitationId = searchParams.get('id')
    const action = searchParams.get('action')
    
    if (invitationId && action && (action === 'accept' || action === 'decline')) {
      handleDirectInvitation(invitationId, action)
    }
  }, [searchParams])

  const loadInvitations = async () => {
    try {
      const data = await invitationsApi.getInvitations()
      setInvitations(data)
    } catch (error: unknown) {
      console.error('Failed to load invitations:', error)
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDirectInvitation = async (invitationId: string, action: string) => {
    try {
      if (action === 'accept') {
        await acceptInvitation(invitationId)
        toast.success('Invitation accepted! You can now access the conversation.')
      } else if (action === 'decline') {
        await declineInvitation(invitationId)
        toast('Invitation declined.', { icon: '✉️' })
      }
      
      // Clear URL parameters
      navigate('/invitations', { replace: true })
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error)
    }
  }

  const acceptInvitation = async (invitationId: string) => {
    setProcessing(invitationId)
    try {
      await invitationsApi.acceptInvitation(invitationId)
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
      toast.success('Invitation accepted! The conversation has been added to your chats.')
    } catch (error: unknown) {
      console.error('Failed to accept invitation:', error)
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to accept invitation')
    } finally {
      setProcessing(null)
    }
  }

  const declineInvitation = async (invitationId: string) => {
    setProcessing(invitationId)
    try {
      await invitationsApi.declineInvitation(invitationId)
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
    } catch (error: unknown) {
      console.error('Failed to decline invitation:', error)
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to decline invitation')
    } finally {
      setProcessing(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invitations</h1>
            <p className="text-gray-600 mt-2">
              Manage your conversation invitations
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Welcome, {user?.name || user?.email}
            </span>
            <button
              onClick={() => navigate('/chat')}
              className="btn btn-primary"
            >
              Back to Chat
            </button>
          </div>
        </div>

        {/* Invitations List */}
        {invitations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-5v3H5V8a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No pending invitations
            </h3>
            <p className="text-gray-500">
              You don't have any pending conversation invitations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {invitation.conversation.title || 'Untitled Conversation'}
                      </h3>
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Pending
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-2">
                      <span className="font-medium">
                        {invitation.sender.name || invitation.sender.email}
                      </span>
                      {' '}has invited you to join this conversation
                    </p>
                    
                    <p className="text-sm text-gray-500">
                      Received on {formatDate(invitation.createdAt)}
                    </p>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => acceptInvitation(invitation.id)}
                      disabled={processing === invitation.id}
                      className={`btn btn-primary ${
                        processing === invitation.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {processing === invitation.id ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => declineInvitation(invitation.id)}
                      disabled={processing === invitation.id}
                      className={`btn btn-secondary ${
                        processing === invitation.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How invitations work:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• When someone invites you to a conversation, you'll receive an email notification</li>
            <li>• Click the link in the email or accept the invitation here to join the conversation</li>
            <li>• Once accepted, the conversation will appear in your chat list</li>
            <li>• You can decline invitations you're not interested in</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 
