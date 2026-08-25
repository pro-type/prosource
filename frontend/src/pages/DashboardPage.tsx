import React, { useState, useEffect } from 'react';
import { leadsAPI } from '../services/api';
import {
  Users,
  Send,
  Clock,
  MessageSquare,
  Trophy,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

interface Stats {
  total: number;
  new: number;
  intro_sent: number;
  followup1_sent: number;
  followup2_sent: number;
  followup3_sent: number;
  responded: number;
  converted: number;
  unresponsive: number;
  activeCampaigns: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        leadsAPI.getStats(),
        leadsAPI.getAll({ limit: 5 }),
      ]);
      setStats(statsRes.data.stats);
      setRecentLeads(leadsRes.data.leads);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const inFollowup =
    (stats?.followup1_sent || 0) +
    (stats?.followup2_sent || 0) +
    (stats?.followup3_sent || 0);

  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.total || 0,
      icon: Users,
      color: '#6366F1',
      bg: 'rgba(99, 102, 241, 0.12)',
    },
    {
      label: 'Intro Sent',
      value: stats?.intro_sent || 0,
      icon: Send,
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      label: 'In Follow-up',
      value: inFollowup,
      icon: Clock,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      label: 'Responded',
      value: stats?.responded || 0,
      icon: MessageSquare,
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
    },
    {
      label: 'Converted',
      value: stats?.converted || 0,
      icon: Trophy,
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.12)',
    },
  ];

  const totalWithStatus = (stats?.total || 1);
  const segments = [
    { label: 'New', value: stats?.new || 0, color: '#6366F1' },
    { label: 'Intro Sent', value: stats?.intro_sent || 0, color: '#3B82F6' },
    { label: 'Follow-up', value: inFollowup, color: '#F59E0B' },
    { label: 'Responded', value: stats?.responded || 0, color: '#10B981' },
    { label: 'Converted', value: stats?.converted || 0, color: '#8B5CF6' },
  ];

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      intro_sent: 'Intro Sent',
      followup1_sent: 'Follow-up 1',
      followup2_sent: 'Follow-up 2',
      followup3_sent: 'Follow-up 3',
      responded: 'Responded',
      converted: 'Converted',
      unresponsive: 'Unresponsive',
    };
    return labels[status] || status;
  };

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Campaign overview and lead analytics</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-primary" onClick={() => navigate('/leads')}>
            <Users size={16} />
            View All Leads
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="stat-card glass-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="stat-card-icon" style={{ background: card.bg }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div className="stat-card-value">{card.value}</div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        {/* Campaign Health */}
        <div className="glass-card dashboard-health">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <TrendingUp size={18} />
              Campaign Health
            </h2>
          </div>

          <div className="health-bar">
            {segments.map((seg, i) => {
              const width = totalWithStatus > 0 ? (seg.value / totalWithStatus) * 100 : 0;
              if (width === 0) return null;
              return (
                <div
                  key={i}
                  className="health-segment"
                  style={{ width: `${Math.max(width, 2)}%`, background: seg.color }}
                  title={`${seg.label}: ${seg.value}`}
                />
              );
            })}
          </div>

          <div className="health-legend">
            {segments.map((seg, i) => (
              <div key={i} className="health-legend-item">
                <div className="health-legend-dot" style={{ background: seg.color }} />
                <span className="health-legend-label">{seg.label}</span>
                <span className="health-legend-value">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="glass-card dashboard-recent">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              <Users size={18} />
              Recent Leads
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>
              View all <ArrowRight size={14} />
            </button>
          </div>

          {recentLeads.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p className="empty-state-text">No leads yet. Import your list to get started!</p>
              <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/leads')}>
                Add Leads
              </button>
            </div>
          ) : (
            <div className="recent-leads-list">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="recent-lead-item"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <div className="recent-lead-avatar">
                    {lead.contactPerson?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="recent-lead-info">
                    <span className="recent-lead-name">{lead.contactPerson}</span>
                    <span className="recent-lead-company">{lead.company}</span>
                  </div>
                  <span className={`badge badge-${lead.status}`}>
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Campaigns Count */}
      <div className="dashboard-footer glass-card">
        <div className="dashboard-active">
          <div className="dashboard-active-dot" />
          <span>
            <strong>{stats?.activeCampaigns || 0}</strong> active campaigns running
          </span>
        </div>
      </div>
    </div>
  );
}
