'use client';

import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Animated progress bar (loops)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', sans-serif;
          background: #020817;
          overflow: hidden;
        }

        .page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: linear-gradient(135deg, #020817 0%, #0a1628 50%, #020817 100%);
          overflow: hidden;
        }

        /* Animated background orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: float 8s ease-in-out infinite;
        }
        .orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #3b82f6, transparent);
          top: -200px; left: -200px;
          animation-delay: 0s;
        }
        .orb-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #8b5cf6, transparent);
          bottom: -150px; right: -150px;
          animation-delay: -3s;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #06b6d4, transparent);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -6s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }

        /* Grid overlay */
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* Particles */
        .particle {
          position: absolute;
          width: 2px; height: 2px;
          background: rgba(59, 130, 246, 0.6);
          border-radius: 50%;
          animation: sparkle 4s ease-in-out infinite;
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }

        /* Card */
        .card {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 60px 56px;
          max-width: 580px;
          width: 90%;
          text-align: center;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05),
            0 40px 80px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1);
          animation: fadeUp 0.8s ease-out both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Icon */
        .icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px; height: 80px;
          background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2));
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 20px;
          margin-bottom: 32px;
          box-shadow: 0 0 30px rgba(59,130,246,0.15);
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(59,130,246,0.15); }
          50% { box-shadow: 0 0 50px rgba(59,130,246,0.35); }
        }

        .icon-svg {
          color: #60a5fa;
          width: 36px; height: 36px;
        }

        /* Badge */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          color: #93c5fd;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 24px;
        }
        .badge-dot {
          width: 6px; height: 6px;
          background: #3b82f6;
          border-radius: 50%;
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        /* Heading */
        .heading {
          font-size: 42px;
          font-weight: 800;
          line-height: 1.15;
          color: #ffffff;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }
        .heading span {
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.45);
          line-height: 1.7;
          margin-bottom: 40px;
          font-weight: 400;
        }

        /* Progress section */
        .progress-section {
          margin-bottom: 36px;
        }
        .progress-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .progress-text {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .progress-bar-track {
          height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 100px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 100px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          box-shadow: 0 0 10px rgba(59,130,246,0.5);
          transition: width 0.08s linear;
        }

        /* Status pills */
        .pills {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }
        .pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          font-weight: 500;
        }
        .pill-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
        }
        .dot-green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .dot-yellow { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }

        /* Divider */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 0 0 32px;
        }

        /* Footer */
        .footer-text {
          font-size: 13px;
          color: rgba(255,255,255,0.2);
          font-weight: 400;
        }
        .footer-text strong {
          color: rgba(255,255,255,0.4);
          font-weight: 600;
        }

        /* Status indicator */
        .status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 40px;
        }
        .status-line {
          height: 1px;
          width: 40px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15));
        }
        .status-line-r {
          background: linear-gradient(90deg, rgba(255,255,255,0.15), transparent);
        }
        .status-label {
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
        }
      `}</style>

      <div className="page">
        {/* Background orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* Grid */}
        <div className="grid-overlay" />

        {/* Scattered particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${10 + i * 8}%`,
              top: `${15 + (i % 5) * 18}%`,
              animationDelay: `${i * 0.35}s`,
              animationDuration: `${3 + (i % 3)}s`,
            }}
          />
        ))}

        {/* Main card */}
        <div className="card">
          {/* Icon */}
          <div className="icon-wrapper">
            <svg className="icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
              />
            </svg>
          </div>

          {/* Badge */}
          <div className="badge">
            <div className="badge-dot" />
            Scheduled Maintenance
          </div>

          {/* Heading */}
          <h1 className="heading">
            We&apos;re <span>upgrading</span><br />for you
          </h1>

          <p className="subtitle">
            Our platform is currently undergoing scheduled maintenance
            to deliver a better experience. We&apos;ll be back shortly.
          </p>

          {/* Progress */}
          <div className="progress-section">
            <div className="progress-label">
              <span className="progress-text">Progress</span>
              <span className="progress-text">{progress}%</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Status pills */}
          <div className="pills">
            <div className="pill">
              <div className="pill-dot dot-green" />
              Database{dots}
            </div>
            <div className="pill">
              <div className="pill-dot dot-yellow" />
              Services updating
            </div>
            <div className="pill">
              <div className="pill-dot dot-green" />
              Security OK
            </div>
          </div>

          <div className="divider" />

          {/* Footer */}
          <p className="footer-text">
            <strong>vfinserve.in</strong> · Sourcecorp Solution Platform
          </p>
        </div>
      </div>
    </>
  );
}
