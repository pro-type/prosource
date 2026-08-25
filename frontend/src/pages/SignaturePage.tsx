import React, { useState, useEffect } from 'react';
import { signaturesAPI } from '../services/api';
import { Save, Plus, Trash2, Link2, Globe, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';
import './SignaturePage.css';

interface SignatureLink {
  label: string;
  url: string;
  icon: string;
}

export default function SignaturePage() {
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editData, setEditData] = useState({
    name: '',
    role: '',
    tagline: '',
    links: [] as SignatureLink[],
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    try {
      const res = await signaturesAPI.getAll();
      setSignatures(res.data.signatures);
      if (res.data.signatures.length > 0) {
        const sig = res.data.signatures[0];
        setActiveId(sig.id);
        let links: SignatureLink[] = [];
        try {
          links = typeof sig.links === 'string' ? JSON.parse(sig.links) : sig.links;
        } catch { links = []; }
        setEditData({ name: sig.name, role: sig.role || '', tagline: sig.tagline || '', links });
      }
    } catch (error) {
      toast.error('Failed to load signatures');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeId) {
        await signaturesAPI.update(activeId, editData);
        toast.success('Signature saved');
      } else {
        await signaturesAPI.create({ ...editData, isDefault: true });
        toast.success('Signature created');
      }
      loadSignatures();
    } catch (error) {
      toast.error('Failed to save signature');
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    setEditData({
      ...editData,
      links: [...editData.links, { label: '', url: '', icon: 'link' }],
    });
  };

  const removeLink = (index: number) => {
    setEditData({
      ...editData,
      links: editData.links.filter((_, i) => i !== index),
    });
  };

  const updateLink = (index: number, field: keyof SignatureLink, value: string) => {
    const newLinks = [...editData.links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setEditData({ ...editData, links: newLinks });
  };

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'linkedin': return <Linkedin size={14} />;
      case 'globe': return <Globe size={14} />;
      default: return <Link2 size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="signature-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Signature</h1>
          <p className="page-subtitle">Customize your email signature</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><Save size={16} /> Save Signature</>}
        </button>
      </div>

      <div className="signature-layout">
        {/* Editor */}
        <div className="glass-card signature-editor">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Edit Signature</h2>

          <div className="signature-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} placeholder="Harsh Patel" />
            </div>
            <div className="form-group">
              <label className="form-label">Role / Title</label>
              <input className="form-input" value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} placeholder="Founder & CEO" />
            </div>
            <div className="form-group">
              <label className="form-label">Tagline</label>
              <input className="form-input" value={editData.tagline} onChange={(e) => setEditData({ ...editData, tagline: e.target.value })} placeholder="Helping businesses grow with expert solutions" />
            </div>

            <div className="signature-links-section">
              <div className="flex items-center justify-between mb-md">
                <label className="form-label" style={{ marginBottom: 0 }}>Links</label>
                <button className="btn btn-ghost btn-sm" onClick={addLink}>
                  <Plus size={14} /> Add Link
                </button>
              </div>

              {editData.links.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No links added yet</p>
              ) : (
                <div className="signature-links-list">
                  {editData.links.map((link, i) => (
                    <div key={i} className="signature-link-row">
                      <select className="form-select" value={link.icon} onChange={(e) => updateLink(i, 'icon', e.target.value)} style={{ width: 100 }}>
                        <option value="link">Link</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="globe">Website</option>
                      </select>
                      <input className="form-input" value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Label" style={{ width: 120 }} />
                      <input className="form-input" value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
                      <button className="btn btn-ghost btn-icon" onClick={() => removeLink(i)} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="glass-card signature-preview-panel">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Preview</h2>

          <div className="signature-preview">
            <div className="sig-preview-divider" />
            <div className="sig-preview-name">{editData.name || 'Your Name'}</div>
            {editData.role && <div className="sig-preview-role">{editData.role}</div>}
            {editData.tagline && <div className="sig-preview-tagline">{editData.tagline}</div>}
            {editData.links.length > 0 && (
              <div className="sig-preview-links">
                {editData.links.map((link, i) => (
                  <a key={i} href={link.url || '#'} className="sig-preview-link" target="_blank" rel="noopener noreferrer">
                    {getIconComponent(link.icon)}
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 'var(--space-md)' }}>
            This is how your signature will appear at the bottom of every campaign email.
          </p>
        </div>
      </div>
    </div>
  );
}
