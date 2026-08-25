import React, { useState, useEffect } from 'react';
import { templatesAPI } from '../services/api';
import { Plus, FileText, Check, Trash2, Save, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import './TemplatesPage.css';

const STEP_NAMES = ['Intro', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3'];

const MERGE_FIELDS = [
  { field: '{{company}}', description: 'Company name' },
  { field: '{{contactPerson}}', description: 'Contact person name' },
  { field: '{{serviceNeed}}', description: 'Service need / project type' },
  { field: '{{country}}', description: 'Country' },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editData, setEditData] = useState<any>({});
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await templatesAPI.getAll();
      setTemplates(res.data.templates);
      if (res.data.templates.length > 0 && !selectedTemplate) {
        selectTemplate(res.data.templates[0]);
      }
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setEditData({
      name: template.name,
      introSubject: template.introSubject,
      introBody: template.introBody,
      followup1Subject: template.followup1Subject,
      followup1Body: template.followup1Body,
      followup2Subject: template.followup2Subject,
      followup2Body: template.followup2Body,
      followup3Subject: template.followup3Subject,
      followup3Body: template.followup3Body,
    });
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await templatesAPI.update(selectedTemplate.id, editData);
      toast.success('Template saved');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await templatesAPI.create({
        name: newName,
        introSubject: 'Helping {{company}} with {{serviceNeed}}',
        introBody: 'Hi {{contactPerson}},\n\nI came across {{company}} and...',
        followup1Subject: 'Re: Helping {{company}} with {{serviceNeed}}',
        followup1Body: 'Hi {{contactPerson}},\n\nJust following up on my previous email...',
        followup2Subject: 'Quick follow-up — {{company}}',
        followup2Body: 'Hi {{contactPerson}},\n\nI wanted to reach out one more time...',
        followup3Subject: 'Last check-in — {{company}}',
        followup3Body: 'Hi {{contactPerson}},\n\nThis will be my last follow-up...',
      });
      toast.success('Template created');
      setShowCreateModal(false);
      setNewName('');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await templatesAPI.update(id, { isDefault: true });
      toast.success('Default template updated');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to update default');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await templatesAPI.delete(id);
      toast.success('Template deleted');
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const getFieldsForTab = (tab: number) => {
    const prefixes = ['intro', 'followup1', 'followup2', 'followup3'];
    const prefix = prefixes[tab];
    return {
      subjectKey: `${prefix}Subject`,
      bodyKey: `${prefix}Body`,
    };
  };

  const { subjectKey, bodyKey } = getFieldsForTab(activeTab);

  // Sample preview data
  const previewData = {
    company: 'TechFlow Inc.',
    contactPerson: 'Alex Chen',
    serviceNeed: 'full-stack development',
    country: 'Singapore',
  };

  const previewText = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, field) => (previewData as any)[field] || `{{${field}}}`);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="templates-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Manage your email campaign templates</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> New Template
        </button>
      </div>

      <div className="templates-layout">
        {/* Template List */}
        <div className="templates-sidebar glass-card">
          <div className="templates-sidebar-header">
            <h3>Your Templates</h3>
          </div>
          {templates.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p className="empty-state-text">No templates yet</p>
            </div>
          ) : (
            <div className="templates-list">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`template-item ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                  onClick={() => selectTemplate(t)}
                >
                  <FileText size={16} />
                  <div className="template-item-info">
                    <span className="template-item-name">{t.name}</span>
                    {t.isDefault && <span className="badge badge-active" style={{ fontSize: 10, padding: '2px 6px' }}>Default</span>}
                  </div>
                  <div className="template-item-actions">
                    {!t.isDefault && (
                      <button className="btn btn-ghost btn-icon" title="Set Default" onClick={(e) => { e.stopPropagation(); handleSetDefault(t.id); }} style={{ padding: 4 }}>
                        <Check size={14} />
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} style={{ padding: 4, color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Editor */}
        {selectedTemplate ? (
          <div className="template-editor">
            <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
              <div className="flex items-center justify-between mb-md">
                <div className="form-group" style={{ flex: 1, marginRight: 16 }}>
                  <label className="form-label">Template Name</label>
                  <input className="form-input" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><Save size={14} /> Save</>}
                </button>
              </div>

              {/* Tabs */}
              <div className="tabs">
                {STEP_NAMES.map((name, i) => (
                  <button key={i} className={`tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
                    {name}
                  </button>
                ))}
              </div>

              {/* Editor */}
              <div className="template-edit-fields">
                <div className="form-group mb-md">
                  <label className="form-label">Subject Line</label>
                  <input
                    className="form-input"
                    value={editData[subjectKey] || ''}
                    onChange={(e) => setEditData({ ...editData, [subjectKey]: e.target.value })}
                    placeholder="Enter subject line with {{merge}} fields"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Body</label>
                  <textarea
                    className="form-textarea"
                    rows={12}
                    value={editData[bodyKey] || ''}
                    onChange={(e) => setEditData({ ...editData, [bodyKey]: e.target.value })}
                    placeholder="Write your email body with {{merge}} fields..."
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                Preview (with sample data)
              </h3>
              <div className="template-preview">
                <div className="preview-subject">
                  <strong>Subject:</strong> {previewText(editData[subjectKey] || '')}
                </div>
                <div className="preview-body">
                  {previewText(editData[bodyKey] || '').split('\n').map((line: string, i: number) => (
                    <p key={i} style={{ marginBottom: line ? 8 : 16 }}>{line || '\u00A0'}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card template-editor" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={28} style={{ color: 'var(--accent-indigo)' }} />
              </div>
              <p className="empty-state-title">Select a template</p>
              <p className="empty-state-text">Choose a template from the left to edit</p>
            </div>
          </div>
        )}

        {/* Merge Field Cheatsheet */}
        <div className="merge-fields-panel glass-card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} /> Merge Fields
          </h3>
          <div className="merge-fields-list">
            {MERGE_FIELDS.map((mf, i) => (
              <div key={i} className="merge-field-item">
                <code className="merge-field-code">{mf.field}</code>
                <span className="merge-field-desc">{mf.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">New Template</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Template Name</label>
                <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Aggressive Follow-up" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
