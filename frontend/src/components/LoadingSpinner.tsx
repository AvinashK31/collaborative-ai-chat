/**
 * Props interface for the LoadingSpinner component.
 */
interface LoadingSpinnerProps {
  /** Size of the spinner - small, medium, or large */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes to apply to the spinner */
  className?: string
}

/**
 * LoadingSpinner component for displaying loading states.
 * 
 * This component renders an animated spinning circle to indicate loading states
 * throughout the application. It supports different sizes and custom styling.
 * 
 * @param props - Component props
 * @param props.size - Size of the spinner (default: 'md')
 * @param props.className - Additional CSS classes
 * 
 * @example
 * ```tsx
 * // Default medium size
 * <LoadingSpinner />
 * 
 * // Small size with custom class
 * <LoadingSpinner size="sm" className="text-blue-500" />
 * 
 * // Large size
 * <LoadingSpinner size="lg" />
 * ```
 */
export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  /** CSS classes for different spinner sizes */
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div 
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${sizeClasses[size]} ${className}`}
      data-testid="loading-spinner"
    />
  )
} 