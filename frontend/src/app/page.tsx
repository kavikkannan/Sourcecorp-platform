'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  BarChart3,
  Users,
  FileText,
  CheckCircle,
  Lock,
  ArrowRight,
  Zap,
  Layers,
  Clock,
  Globe,
  ChevronRight,
  Menu,
  X,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';

// ===================================================================
// NAVBAR
// ===================================================================

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">Sourcecorp</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
            Features
          </a>
          <a href="#stats" className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
            Platform
          </a>
          <Link
            href="/login"
            className="text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>

        <button className="md:hidden text-slate-700 p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
          >
            <div className="px-6 py-4 space-y-3">
              <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-600 hover:text-slate-900 font-medium">
                Features
              </a>
              <a href="#stats" onClick={() => setMobileOpen(false)} className="block text-sm text-slate-600 hover:text-slate-900 font-medium">
                Platform
              </a>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block text-center text-sm font-semibold text-white bg-slate-900 px-5 py-2.5 rounded-lg"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ===================================================================
// HERO SECTION
// ===================================================================

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 via-white to-white" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-100/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4" />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Enterprise Business Management Platform
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.08] mb-6"
        >
          Streamline Your
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            Business Operations
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
          className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          A unified platform for CRM, financial tools, task management,
          and team collaboration — built for modern enterprises.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            Explore Features
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-slate-400 text-sm"
        >
          <span className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            Bank-Level Security
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-slate-400" />
            Role-Based Access
          </span>
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Cloud Native
          </span>
        </motion.div>

        {/* Hero visual - abstract dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="mt-16 relative max-w-4xl mx-auto"
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="max-w-xs mx-auto h-6 bg-white rounded-md border border-slate-200 flex items-center px-3 text-[10px] text-slate-400">
                  platform.sourcecorp.com
                </div>
              </div>
            </div>
            {/* Dashboard mockup */}
            <div className="p-6 grid grid-cols-12 gap-4">
              {/* Sidebar */}
              <div className="col-span-3 space-y-3">
                <div className="h-8 w-32 bg-slate-100 rounded-lg" />
                <div className="h-2 w-20 bg-slate-100 rounded" />
                <div className="pt-4 space-y-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-100" />
                      <div className="h-2 w-16 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Main content */}
              <div className="col-span-9 space-y-4">
                <div className="flex gap-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 h-20 bg-slate-50 rounded-xl border border-slate-100 p-3">
                      <div className="h-2 w-12 bg-slate-200 rounded mb-2" />
                      <div className="h-6 w-16 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
                <div className="h-40 bg-slate-50 rounded-xl border border-slate-100 p-4">
                  <div className="h-2 w-24 bg-slate-200 rounded mb-4" />
                  <div className="space-y-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100" />
                        <div className="flex-1 h-2 bg-slate-100 rounded" />
                        <div className="w-12 h-2 bg-slate-100 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-32 bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="h-2 w-20 bg-slate-200 rounded mb-3" />
                    <div className="h-16 bg-blue-50 rounded-lg" />
                  </div>
                  <div className="h-32 bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="h-2 w-20 bg-slate-200 rounded mb-3" />
                    <div className="h-16 bg-violet-50 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-gradient-to-t from-blue-500/5 to-transparent rounded-3xl -z-10 blur-xl" />
        </motion.div>
      </div>
    </section>
  );
}

// ===================================================================
// FEATURES SECTION
// ===================================================================

const FEATURES = [
  {
    icon: Users,
    title: 'CRM Management',
    description: 'Track leads, manage cases, and monitor customer interactions with a full-featured CRM pipeline.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BarChart3,
    title: 'Financial Tools',
    description: 'Credit appraisal, obligation sheets, and eligibility calculators with dynamic template builders.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: FileText,
    title: 'Task Management',
    description: 'Hierarchical task assignment with upward and downward delegation, status tracking, and notifications.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description: 'Granular permissions with users, roles, teams, and audit logging for complete security control.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: Layers,
    title: 'Reporting Hierarchy',
    description: 'Visual org chart with manager-subordinate relationships, history tracking, and batch operations.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: Clock,
    title: 'Audit & Compliance',
    description: 'Comprehensive audit trails, change history, and compliance-ready reporting for every action.',
    color: 'bg-slate-100 text-slate-600',
  },
];

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
    >
      <div className={`w-11 h-11 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
        <feature.icon className="w-5 h-5" />
      </div>
      <h3 className="text-slate-900 font-semibold text-lg mb-2">{feature.title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 mb-4">
            <Layers className="w-3.5 h-3.5" />
            Everything You Need
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Powerful Tools for{' '}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Modern Teams
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            An integrated suite of business applications designed to work seamlessly together.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// STATS SECTION
// ===================================================================

const STATS = [
  { label: 'Active Users', value: '500+', icon: Users },
  { label: 'Cases Managed', value: '10K+', icon: TrendingUp },
  { label: 'Uptime', value: '99.9%', icon: CheckCircle },
  { label: 'Modules', value: '6', icon: Layers },
];

function StatsSection() {
  return (
    <section id="stats" className="relative py-20 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-4">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-2">{stat.value}</div>
              <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// CTA SECTION
// ===================================================================

function CTASection() {
  return (
    <section className="relative py-24 sm:py-32 bg-slate-50/50 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-100/50 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 mb-6 shadow-lg shadow-blue-900/10">
            <Award className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Ready to Transform Your
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Business Workflow?
            </span>
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-10">
            Join the growing number of enterprises using Sourcecorp Solution Platform
            to streamline operations and drive growth.
          </p>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            Access Platform
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ===================================================================
// FOOTER
// ===================================================================

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-sm">Sourcecorp Solution</span>
          </div>
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Sourcecorp Solution Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Secure
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Reliable
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ===================================================================
// MAIN PAGE
// ===================================================================

export default function LandingPage() {
  return (
    <main className="bg-white min-h-screen text-slate-900 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
