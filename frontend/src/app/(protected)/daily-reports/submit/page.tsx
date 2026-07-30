'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText, BarChart3, Save, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useAuth } from '@/contexts/AuthContext';
import {
  dailyReportService,
  DailyReport,
  openingFields,
  closingFields,
  OpeningReportData,
  ClosingReportData,
} from '@/lib/dailyReports';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SubmitDailyReportPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const reportDate = today();
  const [activeTab, setActiveTab] = useState<'OPENING' | 'CLOSING'>('OPENING');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<DailyReport | null>(null);
  const [success, setSuccess] = useState(false);
  const [openingData, setOpeningData] = useState<Partial<OpeningReportData>>({});
  const [closingData, setClosingData] = useState<Partial<ClosingReportData>>({});

  const loadExisting = useCallback(async () => {
    try {
      setLoading(true);
      const { reports } = await dailyReportService.getReports({ date: reportDate, limit: 1 });
      const report = reports[0] || null;
      setExisting(report);
      if (report) {
        const opening: Partial<OpeningReportData> = {};
        openingFields.forEach((f) => {
          opening[f.key] = String(report[f.key as keyof DailyReport] ?? '');
        });
        setOpeningData(opening);

        const closing: Partial<ClosingReportData> = {};
        closingFields.forEach((f) => {
          closing[f.key] = String(report[f.key as keyof DailyReport] ?? '');
        });
        setClosingData(closing);
      } else {
        setOpeningData({});
        setClosingData({});
      }
    } catch (error) {
      console.error('Failed to load existing report:', error);
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const handleChange = (
    key: string,
    value: string,
    type: 'number' | 'currency'
  ) => {
    if (type === 'number' || type === 'currency') {
      // Allow only numbers and decimals
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    }
    if (activeTab === 'OPENING') {
      setOpeningData((prev) => ({ ...prev, [key]: value }));
    } else {
      setClosingData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleStatusChange = (value: string) => {
    setClosingData((prev) => ({ ...prev, closing_day_status: value }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setSuccess(false);

      const currentData = activeTab === 'OPENING' ? openingData : closingData;
      const payload: Record<string, string | number> = {};

      Object.entries(currentData).forEach(([key, value]) => {
        if (value === '' || value === undefined) return;
        const num = parseFloat(value as string);
        payload[key] = isNaN(num) ? value : num;
      });

      if (activeTab === 'CLOSING' && closingData.closing_day_status) {
        payload.closing_day_status = closingData.closing_day_status;
      }

      await dailyReportService.upsertReport(activeTab, reportDate, payload);
      setSuccess(true);
      await loadExisting();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save report:', error);
      alert(error.response?.data?.error || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const currentFields = activeTab === 'OPENING' ? openingFields : closingFields;
  const isCompleted = existing?.closing_day_status === 'COMPLETED';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Daily Report"
        description="Digitize your opening and closing sales reports"
        action={
          <Link href="/daily-reports">
            <Button variant="secondary" icon={<BarChart3 className="w-4 h-4" />}>
              Reports & Stats
            </Button>
          </Link>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('OPENING')}
              className={`flex-1 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'OPENING'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Opening Report
            </button>
            <button
              onClick={() => setActiveTab('CLOSING')}
              className={`flex-1 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'CLOSING'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Closing Report
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Report Date</span>
            </div>
            <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900">
              {format(new Date(reportDate), 'dd MMM yyyy')}
            </div>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                Day completed
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-16"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {currentFields.map((field) => {
                  if (field.type === 'status') {
                    return (
                      <Select
                        key={field.key}
                        label={field.label}
                        value={(closingData.closing_day_status as string) || ''}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        options={[
                          { value: 'IN_PROGRESS', label: 'In Progress' },
                          { value: 'COMPLETED', label: 'Completed' },
                        ]}
                      />
                    );
                  }

                  const value =
                    activeTab === 'OPENING'
                      ? (openingData[field.key as keyof OpeningReportData] as string) || ''
                      : (closingData[field.key as keyof ClosingReportData] as string) || '';

                  return (
                    <Input
                      key={field.key}
                      type="text"
                      inputMode={field.type === 'currency' ? 'decimal' : 'numeric'}
                      label={field.label}
                      value={value}
                      onChange={(e) => handleChange(field.key, e.target.value, field.type as 'number' | 'currency')}
                      placeholder="0"
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Report saved successfully</span>
            </motion.div>
          )}

          <div className="flex items-center justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={handleSubmit}
              loading={saving}
              disabled={loading}
              icon={<Save className="w-4 h-4" />}
            >
              {activeTab === 'OPENING' ? 'Save Opening Report' : 'Save Closing Report'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
