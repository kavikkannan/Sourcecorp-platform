'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

