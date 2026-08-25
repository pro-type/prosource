import React, { useState, useEffect } from 'react';
import { gmailAPI, campaignsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Play,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    checkGmailStatus();

    // Check for Gmail redirect query params
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail connected successfully!');
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('gmail') === 'error') {
      toast.error('Gmail connection failed');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const checkGmailStatus = async () => {
    try {
      const res = await gmailAPI.getStatus();
      setGmailConnected(res.data.connected);
    } catch (error) {
      console.error('Failed to check Gmail status');
    } finally {
      setGmailLoading(false);
    }
  };

  const connectGmail = async () => {
    try {
      const res = await gmailAPI.getAuthUrl();
      window.location.href = res.data.url;
    } catch (error) {
      toast.error('Failed to generate auth URL. Check your Gmail OAuth credentials in .env');
    }
  };

  const triggerScheduler = async () => {
    setSchedulerRunning(true);
    try {
      const res = await campaignsAPI.triggerScheduler();
      const { processed, succeeded, failed } = res.data;
      if (processed === 0) {
        toast('No follow-ups due right now', { icon: '📭' });
      } else {
        toast.success(`Scheduler ran: ${succeeded} sent, ${failed} failed`);
      }
    } catch (error) {
      toast.error('Failed to trigger scheduler');
    } finally {
      setSchedulerRunning(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setChangingPassword(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="settings-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your ProSource instance</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Gmail Connection */}
        <div className="glass-card settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
              <Mail size={20} style={{ color: '#EF4444' }} />
            </div>
            <div>
              <h2 className="settings-section-title">Gmail Connection</h2>
              <p className="settings-section-desc">Connect your Gmail account to send campaign emails</p>
            </div>
          </div>

          <div className="settings-section-body">
            {gmailLoading ? (
              <div className="loading-container" style={{ padding: 20 }}>
                <div className="spinner" />
              </div>
            ) : gmailConnected ? (
              <div className="gmail-status connected">
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                <div>
                  <strong>Gmail Connected</strong>
                  <p>Your Gmail account is linked and ready to send emails.</p>
                </div>
              </div>
            ) : (
              <div className="gmail-status disconnected">
                <XCircle size={20} style={{ color: 'var(--danger)' }} />
                <div>
                  <strong>Gmail Not Connected</strong>
                  <p>Connect your Gmail account to start sending campaign emails.</p>
                </div>
                <button className="btn btn-primary" onClick={connectGmail}>
                  <ExternalLink size={14} /> Connect Gmail
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scheduler */}
        <div className="glass-card settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
              <Clock size={20} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h2 className="settings-section-title">Campaign Scheduler</h2>
              <p className="settings-section-desc">Automatic follow-up sending configuration</p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-info-grid">
              <div className="settings-info-item">
                <span className="settings-info-label">Follow-up Interval</span>
                <span className="settings-info-value">3 days</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">Schedule</span>
                <span className="settings-info-value">Daily at 9:00 AM</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">Max Steps</span>
                <span className="settings-info-value">4 (Intro + 3 Follow-ups)</span>
              </div>
            </div>

            <button className="btn btn-secondary w-full mt-md" onClick={triggerScheduler} disabled={schedulerRunning}>
              {schedulerRunning ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running...</>
              ) : (
                <><Play size={14} /> Run Scheduler Now</>
              )}
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="glass-card settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
              <Shield size={20} style={{ color: '#6366F1' }} />
            </div>
            <div>
              <h2 className="settings-section-title">Account</h2>
              <p className="settings-section-desc">Manage your admin account</p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-info-grid mb-md">
              <div className="settings-info-item">
                <span className="settings-info-label">Name</span>
                <span className="settings-info-value">{user?.name || 'Admin'}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">Email</span>
                <span className="settings-info-value">{user?.email || '-'}</span>
              </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={changingPassword || !currentPassword || !newPassword}>
                {changingPassword ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        {/* About */}
        <div className="glass-card settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ background: 'var(--accent-gradient-subtle)' }}>
              <Zap size={20} style={{ color: 'var(--accent-indigo)' }} />
            </div>
            <div>
              <h2 className="settings-section-title">About ProSource</h2>
              <p className="settings-section-desc">Powered by Protype</p>
            </div>
          </div>

          <div className="settings-section-body">
            <div className="settings-info-grid">
              <div className="settings-info-item">
                <span className="settings-info-label">Version</span>
                <span className="settings-info-value">1.0.0</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">Stack</span>
                <span className="settings-info-value">React · Express · Prisma · PostgreSQL</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">Email Engine</span>
                <span className="settings-info-value">Gmail API (OAuth2)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
