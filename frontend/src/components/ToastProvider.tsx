'use client';

import { Toaster } from 'sonner';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
      }}
    />
  );
}
