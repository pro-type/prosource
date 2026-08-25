import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsAPI, campaignsAPI, templatesAPI } from '../services/api';
import {
  Search,
  Plus,
  Upload,
  Play,
  Eye,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import './LeadsPage.css';

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

export default function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  // Templates & Start Campaign
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [targetLeadIds, setTargetLeadIds] = useState<string[]>([]);

  // Add lead form
  const [newLead, setNewLead] = useState({
    company: '', contactPerson: '', email: '', phone: '', country: '', serviceNeed: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Bulk import
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkText, setBulkText] = useState('');

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leadsAPI.getAll({ page, search, status: statusFilter });
      setLeads(res.data.leads);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadLeads();
    templatesAPI.getAll().then(res => setTemplates(res.data.templates)).catch(() => {});
  }, [loadLeads]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await leadsAPI.create(newLead);
      toast.success('Lead added successfully');
      setShowAddModal(false);
      setNewLead({ company: '', contactPerson: '', email: '', phone: '', country: '', serviceNeed: '', notes: '' });
      loadLeads();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkParse = () => {
    if (!bulkText.trim()) return;

    Papa.parse(bulkText.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const parsed = results.data.map((row: any) => ({
          company: row.company || row.Company || row['Company Name'] || '',
          contactPerson: row.contactPerson || row['Contact Person'] || row.Name || row.name || '',
          email: row.email || row.Email || row['Email Address'] || '',
          phone: row.phone || row.Phone || '',
          country: row.country || row.Country || '',
          serviceNeed: row.serviceNeed || row['Service Need'] || row.service || '',
        }));
        setBulkData(parsed.filter((r: any) => r.company && r.contactPerson && r.email));
        toast.success(`Parsed ${parsed.length} rows`);
      },
      error: () => {
        toast.error('Failed to parse CSV data');
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBulkText(text);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (bulkData.length === 0) return;
    setSubmitting(true);
    try {
      const res = await leadsAPI.bulkImport(bulkData);
      toast.success(`Imported ${res.data.imported} leads`);
      setShowBulkModal(false);
      setBulkData([]);
      setBulkText('');
      loadLeads();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import leads');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartCampaign = (leadId: string) => {
    setTargetLeadIds([leadId]);
    const defaultTemplate = templates.find(t => t.isDefault);
    setSelectedTemplateId(defaultTemplate ? defaultTemplate.id : '');
    setShowStartModal(true);
  };

  const handleArchive = async (leadId: string) => {
    try {
      await leadsAPI.delete(leadId);
      toast.success('Lead archived');
      loadLeads();
    } catch (error) {
      toast.error('Failed to archive lead');
    }
  };

  const handleBulkStart = () => {
    if (selectedLeads.size === 0) return;
    setTargetLeadIds(Array.from(selectedLeads));
    const defaultTemplate = templates.find(t => t.isDefault);
    setSelectedTemplateId(defaultTemplate ? defaultTemplate.id : '');
    setShowStartModal(true);
  };

  const confirmStartCampaigns = async () => {
    setSubmitting(true);
    try {
      if (targetLeadIds.length === 1) {
        await campaignsAPI.start(targetLeadIds[0], selectedTemplateId || undefined);
        toast.success('Campaign started — intro email sent!');
      } else {
        const res = await campaignsAPI.bulkStart(targetLeadIds, selectedTemplateId || undefined);
        toast.success(`Started ${res.data.started} campaigns`);
        setSelectedLeads(new Set());
      }
      setShowStartModal(false);
      loadLeads();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start campaigns');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLeads(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  return (
    <div className="leads-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{total} total leads</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={16} />
            Bulk Import
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="leads-filters glass-card">
        <div className="search-bar">
          <Search size={16} className="search-bar-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search leads by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 180 }}
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {selectedLeads.size > 0 && (
          <button className="btn btn-primary btn-sm" onClick={handleBulkStart}>
            <Play size={14} />
            Start Campaigns ({selectedLeads.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card leads-table-card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner spinner-lg" />
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Inbox size={28} style={{ color: 'var(--accent-indigo)' }} />
            </div>
            <h3 className="empty-state-title">No leads found</h3>
            <p className="empty-state-text">
              {search || statusFilter
                ? 'Try adjusting your search or filters'
                : 'Import your lead list or add leads manually to get started'}
            </p>
            {!search && !statusFilter && (
              <button className="btn btn-primary btn-sm mt-md" onClick={() => setShowBulkModal(true)}>
                <Upload size={14} /> Import Leads
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedLeads.size === leads.length && leads.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Step</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="stagger-fade">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {lead.contactPerson}
                      </span>
                    </td>
                    <td>{lead.company}</td>
                    <td>
                      <span className="truncate" style={{ maxWidth: 200, display: 'inline-block' }}>
                        {lead.email}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${lead.status}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td>
                      {lead.campaign ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          Step {lead.campaign.currentStep}/4
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-xs">
                        <button
                          className="btn btn-ghost btn-icon"
                          title="View Details"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <Eye size={16} />
                        </button>
                        {lead.status === 'new' && !lead.campaign && (
                          <button
                            className="btn btn-ghost btn-icon"
                            title="Start Campaign"
                            onClick={() => handleStartCampaign(lead.id)}
                            style={{ color: 'var(--success)' }}
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Archive"
                          onClick={() => handleArchive(lead.id)}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Lead</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLead}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <input className="form-input" required value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} placeholder="Acme Corp" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person *</label>
                  <input className="form-input" required value={newLead.contactPerson} onChange={(e) => setNewLead({ ...newLead, contactPerson: e.target.value })} placeholder="John Smith" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" required value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="john@acme.com" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input className="form-input" value={newLead.country} onChange={(e) => setNewLead({ ...newLead, country: e.target.value })} placeholder="United States" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Service Need</label>
                  <input className="form-input" value={newLead.serviceNeed} onChange={(e) => setNewLead({ ...newLead, serviceNeed: e.target.value })} placeholder="Web development, Design, etc." />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Additional notes..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2 className="modal-title">Bulk Import Leads</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Paste CSV data or upload a CSV file. Required columns: <strong>company</strong>, <strong>contactPerson</strong> (or Name), <strong>email</strong>. Optional: phone, country, serviceNeed.
              </p>

              <div className="form-group mb-md">
                <label className="form-label">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="form-input"
                  style={{ padding: '8px' }}
                />
              </div>

              <div className="form-group mb-md">
                <label className="form-label">Or Paste CSV Data</label>
                <textarea
                  className="form-textarea"
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`company,contactPerson,email,phone,country,serviceNeed\nAcme Corp,John Smith,john@acme.com,+1-555-0001,USA,Web Development\nTech Inc,Jane Doe,jane@tech.com,,India,Mobile App`}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
              </div>

              <button className="btn btn-secondary mb-md" onClick={handleBulkParse}>
                Parse CSV
              </button>

              {bulkData.length > 0 && (
                <div className="bulk-preview">
                  <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 8 }}>
                    ✓ {bulkData.length} valid leads ready to import
                  </p>
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Contact</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkData.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td>{row.company}</td>
                            <td>{row.contactPerson}</td>
                            <td>{row.email}</td>
                          </tr>
                        ))}
                        {bulkData.length > 10 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                              ... and {bulkData.length - 10} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={bulkData.length === 0 || submitting} onClick={handleBulkImport}>
                {submitting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : `Import ${bulkData.length} Leads`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Start Campaign Modal */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Start Campaign{targetLeadIds.length > 1 ? `s (${targetLeadIds.length})` : ''}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowStartModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Select an email template to use for {targetLeadIds.length > 1 ? 'these leads' : 'this lead'}. If no template is selected, the default will be used.
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
              <button className="btn btn-primary" disabled={submitting} onClick={confirmStartCampaigns}>
                {submitting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Send Intro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
