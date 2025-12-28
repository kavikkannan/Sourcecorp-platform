'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Shield,
  UsersRound,
  Megaphone,
  FileText,
  LogOut,
  Briefcase,
  Calculator,
  FileSpreadsheet,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  GitBranch,
  Bell,
  StickyNote,
  Plus,
  ListTodo,
  MessageSquare,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: '', // No permission required - all authenticated users can access
      },
      {
        name: 'Chat',
        href: '/chat',
        icon: MessageSquare,
        permission: 'chat.channel.view',
      },
    ],
  },
  {
    title: 'CRM',
    items: [
      {
        name: 'Cases',
        href: '/crm/cases',
        icon: Briefcase,
        permission: 'crm.case.view',
      },
      {
        name: 'Notifications',
        href: '/crm/notifications',
        icon: Bell,
        permission: 'crm.case.view',
      },
    ],
  },
  {
    title: 'Financial Tools',
    items: [
      {
        name: 'Eligibility Calculator',
        href: '/financial-tools/eligibility',
        icon: Calculator,
        permission: 'finance.eligibility.view',
      },
      {
        name: 'Obligation Sheet',
        href: '/financial-tools/obligation',
        icon: FileSpreadsheet,
        permission: 'finance.obligation.view',
      },
      {
        name: 'CAM / Working Sheet',
        href: '/financial-tools/cam',
        icon: Receipt,
        permission: 'finance.cam.view',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        name: 'Users',
        href: '/admin/users',
        icon: Users,
        permission: 'admin.users.read',
      },
      {
        name: 'Roles',
        href: '/admin/roles',
        icon: Shield,
        permission: 'admin.roles.read',
      },
      {
        name: 'Teams',
        href: '/admin/teams',
        icon: UsersRound,
        permission: 'admin.teams.read',
      },
      {
        name: 'Announcements',
        href: '/admin/announcements',
        icon: Megaphone,
        permission: 'admin.announcements.read',
      },
      {
        name: 'Audit Logs',
        href: '/admin/audit-logs',
        icon: FileText,
        permission: 'admin.audit.read',
      },
      {
        name: 'Hierarchy',
        href: '/admin/hierarchy',
        icon: GitBranch,
        permission: 'admin.hierarchy.manage',
      },
      {
        name: 'CAM Templates',
        href: '/admin/templates/cam',
        icon: Receipt,
        permission: 'finance.template.manage',
      },
      {
        name: 'Obligation Templates',
        href: '/admin/templates/obligation',
        icon: FileSpreadsheet,
        permission: 'finance.template.manage',
      },
    ],
  },
  {
    title: 'Productivity',
    items: [
      {
        name: 'My Tasks',
        href: '/tasks',
        icon: ListTodo,
        permission: '', // Available to all authenticated users
      },
      {
        name: 'Hierarchy Tasks',
        href: '/tasks/hierarchy',
        icon: CheckSquare,
        permission: 'task.view.subordinates',
      },
      {
        name: 'Notes',
        href: '/notes',
        icon: StickyNote,
        permission: '', // Available to all authenticated users
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, hasPermission } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <motion.div
      className={`flex flex-col h-full bg-gray-900 text-white border-r border-gray-800 relative ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.2 }}
    >
      {/* Logo */}
      <div className={`p-6 border-b border-gray-800 ${isCollapsed ? 'px-4' : ''}`}>
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="collapsed-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-xl font-bold tracking-tight">SourceCorp</h1>
              <p className="text-xs text-gray-400 mt-1">Platform</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 z-10 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-gray-300" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-gray-300" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navSections.map((section) => {
          const filteredItems = section.items.filter((item) =>
            !item.permission || hasPermission(item.permission)
          );

          // Always show Overview section (Dashboard)
          if (section.title === 'Overview') {
            if (filteredItems.length === 0) return null;
          }
          
          // For CRM and Financial Tools, show them even if user doesn't have permissions
          // This helps employees see what's available and know what to request
          if ((section.title === 'CRM' || section.title === 'Financial Tools') && filteredItems.length === 0) {
            return (
              <div key={section.title} className="mb-6">
                <div className="px-6 mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {section.title}
                  </h2>
                </div>
                <div className={`space-y-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.href}
                        className={`flex items-center rounded-lg text-gray-500 opacity-50 cursor-not-allowed ${
                          isCollapsed
                            ? 'justify-center px-2 py-2.5'
                            : 'gap-3 px-3 py-2.5'
                        }`}
                        title={isCollapsed ? item.name + ' - Permission required' : 'Permission required - contact administrator'}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <span className="text-sm font-medium">{item.name}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          // Hide Administration section if user has no admin permissions
          if (section.title === 'Administration' && filteredItems.length === 0) {
            return null;
          }
          
          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-6">
              {!isCollapsed && (
                <div className="px-6 mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {section.title}
                  </h2>
                </div>
              )}
              <div className={`space-y-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link key={item.href} href={item.href} title={isCollapsed ? item.name : ''}>
                      <motion.div
                        whileHover={{ x: isCollapsed ? 0 : 2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center rounded-lg transition-colors ${
                          isCollapsed
                            ? 'justify-center px-2 py-2.5'
                            : 'gap-3 px-3 py-2.5'
                        } ${
                          active
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <span className="text-sm font-medium">{item.name}</span>
                        )}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="border-t border-gray-800 bg-gray-800/30 p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Quick Actions
          </h3>
          <Link href="/tasks?action=create&type=personal">
            <motion.div
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Task</span>
            </motion.div>
          </Link>
          <Link href="/notes?action=create">
            <motion.div
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Note</span>
            </motion.div>
          </Link>
        </div>
      )}

      {/* User Section */}
      <div className={`border-t border-gray-800 bg-gray-800/50 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={logout}
          className={`w-full flex items-center text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${
            isCollapsed
              ? 'justify-center px-2 py-2.5'
              : 'gap-3 px-3 py-2.5'
          }`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </motion.button>
      </div>
    </motion.div>
  );
}

