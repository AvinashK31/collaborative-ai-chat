import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    render(<LoadingSpinner data-testid="loading-spinner" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('w-8', 'h-8'); // default md size
  });

  it('renders with small size', () => {
    render(<LoadingSpinner size="sm" data-testid="loading-spinner" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('renders with large size', () => {
    render(<LoadingSpinner size="lg" data-testid="loading-spinner" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('w-12', 'h-12');
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" data-testid="loading-spinner" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass('custom-class');
  });

  it('has correct animation and styling classes', () => {
    render(<LoadingSpinner data-testid="loading-spinner" />);
    
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toHaveClass(
      'animate-spin',
      'rounded-full',
      'border-2',
      'border-gray-300',
      'border-t-primary-600'
    );
  });
});
