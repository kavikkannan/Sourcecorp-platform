'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Home, Bell } from 'lucide-react';
import Link from 'next/link';
import { crmService } from '@/lib/crm';

interface Breadcrumb {
  label: string;
  href: string;
  isActive?: boolean;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const result = await crmService.getUnreadNotificationCount();
        setUnreadCount(result.count);
      } catch (error) {
        console.error('Failed to load unread count:', error);
      }
    };

    loadUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = (): Breadcrumb[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/dashboard' }];

    if (paths.length === 0 || paths[0] === 'dashboard') {
      return breadcrumbs;
    }

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (index === paths.length - 1) {
        breadcrumbs.push({ label, href: currentPath, isActive: true });
      } else {
        breadcrumbs.push({ label, href: currentPath, isActive: false });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Home className="w-4 h-4" />
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                {crumb.isActive ? (
                  <span className="font-medium text-gray-900">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* User Info */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            {pathname.startsWith('/crm') && (
              <Link
                href="/crm/notifications"
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-semibold text-sm">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

