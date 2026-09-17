import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'success';
}

const Alert: React.FC<AlertProps> = ({ children, variant = 'error' }) => {
  const baseClasses = "px-4 py-3 rounded-lg text-sm tracking-wide";
  const variantClasses = {
    error: "bg-rose-900/50 text-rose-300 border border-rose-800",
    success: "bg-green-900/50 text-green-300 border border-green-700"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`} role="alert">
      {children}
    </div>
  );
};

export default Alert;