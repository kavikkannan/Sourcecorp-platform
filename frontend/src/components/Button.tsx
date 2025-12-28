'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  icon,
  className = '',
  disabled,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.99 }}
      className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        variant === 'primary'
          ? 'focus:ring-primary-500'
          : variant === 'danger'
          ? 'focus:ring-red-500'
          : 'focus:ring-gray-500'
      } ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...(props as any)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
    </motion.button>
  );
}

