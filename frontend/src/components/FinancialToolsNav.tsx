'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, FileSpreadsheet, Receipt, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    name: 'Eligibility',
    href: '/financial-tools/eligibility',
    icon: Calculator,
    description: 'Calculate loan eligibility',
  },
  {
    name: 'Obligation',
    href: '/financial-tools/obligation',
    icon: FileSpreadsheet,
    description: 'Manage monthly obligations',
  },
  {
    name: 'CAM',
    href: '/financial-tools/cam',
    icon: Receipt,
    description: 'Credit assessment memo',
  },
];

export default function FinancialToolsNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = pathname === step.href;
          const isCompleted = steps.findIndex(s => s.href === pathname) > index;

          return (
            <div key={step.href} className="flex items-center flex-1">
              <Link
                href={step.href}
                className={`flex items-center gap-3 flex-1 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : isCompleted
                    ? 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                    : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : isCompleted
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      isActive ? 'text-primary-900' : 'text-gray-700'
                    }`}
                  >
                    {step.name}
                  </p>
                  <p
                    className={`text-xs ${
                      isActive ? 'text-primary-600' : 'text-gray-500'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </Link>
              {index < steps.length - 1 && (
                <div className="flex-shrink-0 mx-2">
                  <div
                    className={`w-8 h-0.5 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


