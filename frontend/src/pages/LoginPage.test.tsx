import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginPage from './LoginPage';
import { AuthProvider } from '../contexts/AuthContext';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the AuthContext
const mockLogin = vi.fn();
const mockAuthContext = {
  user: null,
  login: mockLogin,
  logout: vi.fn(),
  register: vi.fn(),
  loading: false,
};

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext') as any;
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    renderLoginPage();

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/create a new account/i)).toBeInTheDocument();
  });

  it('updates form fields when user types', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('calls login function when form is submitted', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows loading state during form submission', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('handles login error correctly', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: errorMessage } },
    });

    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
    });
  });

  it('validates required fields', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('has correct email input type', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('has correct password input type', () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('has proper autocomplete attributes', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });
});
