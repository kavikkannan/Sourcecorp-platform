'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, Smartphone, Loader2, Save, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import { notificationService, NotificationPreference, NotificationType } from '@/lib/notifications';
import { toast } from 'sonner';

const TYPE_LABELS: Record<NotificationType, string> = {
  CASE_REMINDER: 'Case Reminder',
  CHANGE_REQUEST: 'Change Request',
  CASE_ASSIGNMENT: 'Case Assignment',
  STATUS_CHANGE: 'Status Change',
  SYSTEM: 'System',
};

const TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  CASE_REMINDER: 'Scheduled follow-ups and reminders for cases.',
  CHANGE_REQUEST: 'Approval requests for customer detail changes.',
  CASE_ASSIGNMENT: 'When a case is assigned to you.',
  STATUS_CHANGE: 'When a case you follow changes status.',
  SYSTEM: 'Platform-wide announcements and system messages.',
};

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const result = await notificationService.getPreferences();
      setPreferences(result.preferences);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (
    type: NotificationType,
    data: Partial<Omit<NotificationPreference, 'id' | 'user_id' | 'notification_type' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      setSaving((prev) => ({ ...prev, [type]: true }));
      await notificationService.updatePreference(type, data);
      await loadPreferences();
      toast.success(`${TYPE_LABELS[type]} preferences updated`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update preference');
    } finally {
      setSaving((prev) => ({ ...prev, [type]: false }));
    }
  };

  const toggleChannel = (pref: NotificationPreference, channel: 'in_app' | 'email' | 'push') => {
    updatePreference(pref.notification_type, { [channel]: !pref[channel] });
  };

  const changeDigestMode = (pref: NotificationPreference, mode: 'IMMEDIATE' | 'DAILY' | 'WEEKLY') => {
    updatePreference(pref.notification_type, { digest_mode: mode });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Notification Preferences"
        description="Choose how and when you want to be notified"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
              <div className="col-span-4">Notification Type</div>
              <div className="col-span-2 text-center">In-App</div>
              <div className="col-span-2 text-center">Email</div>
              <div className="col-span-2 text-center">Push</div>
              <div className="col-span-2 text-center">Digest Mode</div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {preferences.map((pref) => (
              <div
                key={pref.notification_type}
                className="px-6 py-5 hover:bg-gray-50 transition-colors"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {TYPE_LABELS[pref.notification_type]}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {TYPE_DESCRIPTIONS[pref.notification_type]}
                    </p>
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <ChannelToggle
                      icon={<Bell className="w-4 h-4" />}
                      enabled={pref.in_app}
                      onChange={() => toggleChannel(pref, 'in_app')}
                      disabled={saving[pref.notification_type]}
                    />
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <ChannelToggle
                      icon={<Mail className="w-4 h-4" />}
                      enabled={pref.email}
                      onChange={() => toggleChannel(pref, 'email')}
                      disabled={saving[pref.notification_type]}
                    />
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <ChannelToggle
                      icon={<Smartphone className="w-4 h-4" />}
                      enabled={pref.push}
                      onChange={() => toggleChannel(pref, 'push')}
                      disabled={true}
                      title="Push notifications coming soon"
                    />
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <select
                      value={pref.digest_mode}
                      onChange={(e) =>
                        changeDigestMode(pref, e.target.value as 'IMMEDIATE' | 'DAILY' | 'WEEKLY')
                      }
                      disabled={saving[pref.notification_type] || !pref.email}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="IMMEDIATE">Immediate</option>
                      <option value="DAILY">Daily Digest</option>
                      <option value="WEEKLY">Weekly Digest</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {preferences.length === 0 && (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notification preferences found</p>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-1">About digests</h4>
          <p className="text-sm text-blue-800">
            <strong>Immediate:</strong> Send an email as soon as the notification is created.
            <br />
            <strong>Daily/Weekly:</strong> Bundle unread notifications into a single digest email.
            <br />
            Email channel must be enabled for digest mode to have any effect.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ChannelToggleProps {
  icon: React.ReactNode;
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}

function ChannelToggle({ icon, enabled, onChange, disabled, title }: ChannelToggleProps) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={title || (enabled ? 'Enabled' : 'Disabled')}
      className={`p-2 rounded-lg transition-colors ${
        enabled
          ? 'bg-primary-100 text-primary-600 hover:bg-primary-200'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon}
    </button>
  );
}
