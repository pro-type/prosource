import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadsAPI, campaignsAPI, templatesAPI } from '../services/api';
import {
  ArrowLeft,
  Play,
  SkipForward,
  RefreshCw,
  CheckCircle2,
  Send,
  Clock,
  Check,
  Circle,
  MessageSquare,
  Save,
  ExternalLink,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './LeadDetailsPage.css';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  intro_sent: 'Intro Sent',
  followup1_sent: 'Follow-up 1',
  followup2_sent: 'Follow-up 2',
  followup3_sent: 'Follow-up 3',
  responded: 'Responded',
  converted: 'Converted',
  unresponsive: 'Unresponsive',
};

export default function LeadDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  // Editable fields
  const [editData, setEditData] = useState<any>({});

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  useEffect(() => {
    loadLead();
    templatesAPI.getAll().then(res => setTemplates(res.data.templates)).catch(() => {});
  }, [id]);

  const loadLead = async () => {
    try {
      const res = await leadsAPI.getOne(id!);
      setLead(res.data.lead);
      setEditData({
        company: res.data.lead.company,
        contactPerson: res.data.lead.contactPerson,
        email: res.data.lead.email,
        phone: res.data.lead.phone || '',
        country: res.data.lead.country || '',
        serviceNeed: res.data.lead.serviceNeed || '',
        notes: res.data.lead.notes || '',
      });
    } catch (error) {
      toast.error('Failed to load lead');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await leadsAPI.update(id!, editData);
      toast.success('Lead updated');
      loadLead();
    } catch (error) {
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'start':
          const defaultTemplate = templates.find(t => t.isDefault);
          setSelectedTemplateId(defaultTemplate ? defaultTemplate.id : '');
          setShowStartModal(true);
          return; // Modal will handle the API call
        case 'sendNext':
          await campaignsAPI.sendNext(id!);
          toast.success('Follow-up sent!');
          break;
        case 'syncReplies':
          const syncRes = await campaignsAPI.syncReplies(id!);
          if (syncRes.data.newReplies > 0) {
            toast.success(`Found ${syncRes.data.newReplies} new replies!`);
          } else {
            toast('No new replies found', { icon: '📭' });
          }
          break;
        case 'markConverted':
          await campaignsAPI.markConverted(id!);
          toast.success('Lead marked as converted! 🎉');
          break;
      }
      loadLead();
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Action failed`);
    } finally {
      setActionLoading('');
    }
  };

  const confirmStartCampaign = async () => {
    setActionLoading('start');
    try {
      await campaignsAPI.start(id!, selectedTemplateId || undefined);
      toast.success('Campaign started — intro email sent!');
      setShowStartModal(false);
      loadLead();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start campaign');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!lead) return null;

  const campaign = lead.campaign;
  const replies = lead.replies || [];

  const timelineSteps = [
    {
      label: 'Intro Email',
      date: campaign?.introEmailSentAt,
      step: 1,
    },
    {
      label: 'Follow-up 1',
      date: campaign?.followup1SentAt,
      step: 2,
    },
    {
      label: 'Follow-up 2',
      date: campaign?.followup2SentAt,
      step: 3,
    },
    {
      label: 'Follow-up 3',
      date: campaign?.followup3SentAt,
      step: 4,
    },
  ];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="lead-details fade-in">
      {/* Header */}
      <div className="lead-details-header">
        <button className="btn btn-ghost" onClick={() => navigate('/leads')}>
          <ArrowLeft size={18} /> Back to Leads
        </button>
        <div className="lead-details-title-row">
          <div>
            <h1 className="page-title">{lead.contactPerson}</h1>
            <p className="page-subtitle">{lead.company} · {lead.email}</p>
          </div>
          <span className={`badge badge-${lead.status}`} style={{ fontSize: 14, padding: '6px 14px' }}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
        </div>
      </div>

      <div className="lead-details-grid">
        {/* Left: Lead Info */}
        <div className="lead-info-panel glass-card">
          <div className="lead-info-header">
            <h2>Lead Information</h2>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><Save size={14} /> Save</>}
            </button>
          </div>

          <div className="lead-info-form">
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="form-input" value={editData.company || ''} onChange={(e) => setEditData({ ...editData, company: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-input" value={editData.contactPerson || ''} onChange={(e) => setEditData({ ...editData, contactPerson: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-input" value={editData.country || ''} onChange={(e) => setEditData({ ...editData, country: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Service Need</label>
              <input className="form-input" value={editData.serviceNeed || ''} onChange={(e) => setEditData({ ...editData, serviceNeed: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={4} value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
            </div>
          </div>

          {/* Actions */}
          <div className="lead-actions">
            {!campaign && lead.status === 'new' && (
              <button className="btn btn-primary w-full" onClick={() => handleAction('start')} disabled={!!actionLoading}>
                {actionLoading === 'start' ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Play size={16} /> Start Campaign</>}
              </button>
            )}
            {campaign && campaign.status === 'active' && campaign.currentStep < 4 && (
              <button className="btn btn-secondary w-full" onClick={() => handleAction('sendNext')} disabled={!!actionLoading}>
                {actionLoading === 'sendNext' ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><SkipForward size={16} /> Send Follow-up Now</>}
              </button>
            )}
            {campaign && (
              <button className="btn btn-secondary w-full" onClick={() => handleAction('syncReplies')} disabled={!!actionLoading}>
                {actionLoading === 'syncReplies' ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><RefreshCw size={16} /> Sync Replies</>}
              </button>
            )}
            {(lead.status === 'responded' || campaign?.status === 'responded') && lead.status !== 'converted' && (
              <button className="btn btn-success w-full" onClick={() => handleAction('markConverted')} disabled={!!actionLoading}>
                {actionLoading === 'markConverted' ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><CheckCircle2 size={16} /> Mark Converted</>}
              </button>
            )}
          </div>
        </div>

        {/* Right: Campaign Timeline */}
        <div className="lead-timeline-panel glass-card">
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Campaign Timeline</h2>

          {!campaign ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-state-icon">
                <Send size={24} style={{ color: 'var(--accent-indigo)' }} />
              </div>
              <p className="empty-state-title">No campaign yet</p>
              <p className="empty-state-text">Start a campaign to begin the outreach sequence</p>
            </div>
          ) : (
            <>
              <div className="timeline">
                {timelineSteps.map((step, i) => {
                  const isCompleted = !!step.date;
                  const isCurrent = campaign.currentStep === step.step && campaign.status === 'active';
                  const isPending = !isCompleted && !isCurrent;

                  return (
                    <div key={i} className="timeline-item">
                      <div className={`timeline-dot ${isCompleted ? 'completed' : isCurrent ? 'active' : 'pending'}`}>
                        {isCompleted ? <Check size={12} color="white" /> :
                         isCurrent ? <Clock size={12} color="white" /> :
                         <Circle size={12} color="var(--text-dim)" />}
                      </div>
                      <div className="timeline-label">{step.label}</div>
                      {isCompleted && (
                        <div className="timeline-date">{formatDate(step.date)}</div>
                      )}
                      {isCurrent && campaign.nextFollowupDue && (
                        <div className="timeline-date" style={{ color: 'var(--warning)' }}>
                          Due: {formatDate(campaign.nextFollowupDue)}
                        </div>
                      )}
                      {isPending && (
                        <div className="timeline-date">Pending</div>
                      )}
                    </div>
                  );
                })}

                {/* Response marker */}
                {campaign.responseReceivedAt && (
                  <div className="timeline-item">
                    <div className="timeline-dot completed" style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
                      <MessageSquare size={12} color="white" />
                    </div>
                    <div className="timeline-label" style={{ color: 'var(--success)' }}>Response Received</div>
                    <div className="timeline-date">{formatDate(campaign.responseReceivedAt)}</div>
                  </div>
                )}
              </div>

              {/* Campaign Meta */}
              <div className="campaign-meta">
                <div className="campaign-meta-item">
                  <span className="campaign-meta-label">Status</span>
                  <span className={`badge badge-${campaign.status}`}>{campaign.status}</span>
                </div>
                <div className="campaign-meta-item">
                  <span className="campaign-meta-label">Step</span>
                  <span>{campaign.currentStep} / 4</span>
                </div>
                {campaign.gmailThreadId && (
                  <div className="campaign-meta-item">
                    <span className="campaign-meta-label">Gmail Thread</span>
                    <a
                      href={`https://mail.google.com/mail/u/0/#inbox/${campaign.gmailThreadId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-xs"
                    >
                      Open in Gmail <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reply Thread */}
      {replies.length > 0 && (
        <div className="lead-replies glass-card">
          <div className="lead-replies-header">
            <h2>
              <MessageSquare size={18} /> Email Thread
            </h2>
            {campaign && (
              <button className="btn btn-ghost btn-sm" onClick={() => handleAction('syncReplies')} disabled={!!actionLoading}>
                <RefreshCw size={14} /> Sync
              </button>
            )}
          </div>

          <div className="chat-container">
            {replies.map((reply: any) => (
              <div key={reply.id} className={`chat-bubble ${reply.direction === 'sent' ? 'sent' : 'received'}`}>
                <div className="chat-bubble-content">
                  <div className="chat-bubble-from">
                    {reply.direction === 'sent' ? 'You' : reply.fromName || reply.fromEmail}
                  </div>
                  <div className="chat-bubble-subject">{reply.subject}</div>
                  <div className="chat-bubble-body" dangerouslySetInnerHTML={{
                    __html: reply.direction === 'received' ? reply.body.replace(/\n/g, '<br>') : ''
                  }} />
                  {reply.direction === 'received' && !reply.body && (
                    <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Email content synced</p>
                  )}
                </div>
                <div className="chat-meta">
                  {formatDate(reply.receivedAt || reply.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Campaign Modal */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Start Campaign</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowStartModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Select an email template to use for this lead. If no template is selected, the default will be used.
              </p>
              <div className="form-group">
                <label className="form-label">Email Template</label>
                <select 
                  className="form-select" 
                  value={selectedTemplateId} 
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">-- Use Default Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStartModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={actionLoading === 'start'} onClick={confirmStartCampaign}>
                {actionLoading === 'start' ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Send Intro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
