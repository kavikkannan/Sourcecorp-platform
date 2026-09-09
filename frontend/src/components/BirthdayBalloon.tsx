'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

const SHAYIN_URL =
  process.env.NEXT_PUBLIC_SHAYIN_URL || 'https://shayin.vfinserv.in/';

// Wandering path for the balloon (pixel offsets from its anchor spot, looped).
const PATH_X = [0, 160, -40, 220, 60, 0];
const PATH_Y = [0, 110, 240, 80, 200, 0];

// Pop fragments scatter outward from the burst point.
const FRAGMENTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.6;
  const dist = 70 + Math.random() * 70;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    rotate: Math.random() * 240 - 120,
    size: 6 + Math.random() * 8,
    tint: ['bg-rose-400', 'bg-amber-300', 'bg-pink-300', 'bg-red-400'][i % 4],
  };
});

type Phase = 'wander' | 'fly' | 'pop';

export default function BirthdayBalloon() {
  const reduceMotion = useReducedMotion();
  const controls = useAnimation();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const timers = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>('wander');

  useEffect(() => {
    if (reduceMotion) return;
    // Kick off the endless wander; stopped on click in favor of the fly-to-center.
    controls.start({
      x: PATH_X,
      y: PATH_Y,
      rotate: [0, 6, -5, 4, -6, 0],
      transition: { duration: 42, repeat: Infinity, ease: 'easeInOut' },
    });
    return () => {
      controls.stop();
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, [controls, reduceMotion]);

  const redirect = () => {
    window.location.href = SHAYIN_URL;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (phase !== 'wander') return;
    if (reduceMotion || !anchorRef.current) {
      redirect();
      return;
    }

    setPhase('fly');
    controls.stop();
    const rect = anchorRef.current.getBoundingClientRect();
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

    controls
      .start({
        x: dx,
        y: dy,
        scale: 1.7,
        rotate: 0,
        transition: { duration: 0.7, ease: 'easeInOut' },
      })
      .then(() => {
        setPhase('pop');
        timers.current.push(window.setTimeout(redirect, 700));
      });
  };

  return (
    <motion.a
      ref={anchorRef}
      href={SHAYIN_URL}
      onClick={handleClick}
      aria-label="Shayin's birthday page"
      title="A little surprise for Shayin"
      className="group fixed left-[70%] top-[18%] z-50 block select-none"
      initial={{ x: 0, y: 0, rotate: 0 }}
      animate={controls}
    >
      {phase === 'pop' ? (
        <span className="relative block">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1.6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="block text-4xl"
          >
            💥
          </motion.span>
          {FRAGMENTS.map((f, i) => (
            <motion.span
              key={i}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: f.x, y: f.y, rotate: f.rotate, opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className={`absolute left-1/2 top-1/2 rounded-full ${f.tint}`}
              style={{ width: f.size, height: f.size }}
            />
          ))}
        </span>
      ) : (
        <>
          <span
            className={`block text-4xl drop-shadow-lg transition-transform duration-300 ${
              phase === 'wander' ? 'group-hover:scale-125' : ''
            }`}
          >
            🎈
          </span>
          {phase === 'wander' && (
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900/90 px-3 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
              Happy Birthday Shayin 🎂
            </span>
          )}
        </>
      )}
    </motion.a>
  );
}
