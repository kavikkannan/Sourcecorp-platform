'use client';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({ label, error, icon, className = '', ...props }: InputProps) {
  const inputElement = (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          {icon}
        </div>
      )}
      <input
        className={`w-full ${icon ? 'pl-10' : 'px-4'} py-2 pr-4 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
    </div>
  );

  if (label) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {inputElement}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <>
      {inputElement}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </>
  );
}

