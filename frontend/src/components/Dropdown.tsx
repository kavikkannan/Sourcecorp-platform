'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical } from 'lucide-react';

interface DropdownItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  icon?: React.ReactNode;
}

interface DropdownProps {
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export default function Dropdown({ items, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calculate position for fixed dropdown
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 4,
          left: align === 'right' ? rect.right - 192 : rect.left, // 192px = w-48
          right: align === 'right' ? window.innerWidth - rect.right : window.innerWidth - rect.left - 192,
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, align]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[90]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              ref={dropdownMenuRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              style={{
                position: 'fixed',
                zIndex: 1000,
                top: `${position.top}px`,
                ...(align === 'right' ? { right: `${position.right}px` } : { left: `${position.left}px` }),
              }}
              className="w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-64 overflow-y-auto"
            >
              {items.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    item.variant === 'danger'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


