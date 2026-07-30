'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import NotificationDropdown from '@/components/NotificationDropdown';

interface Breadcrumb {
  label: string;
  href: string;
  isActive?: boolean;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

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
            {pathname.startsWith('/crm') && <NotificationDropdown />}
            
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

