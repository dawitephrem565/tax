'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText, RefreshCw, Plus, Printer, Save,
  Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Edit3
} from 'lucide-react';
import { toast } from 'sonner';

interface AgreementTemplate {
  id: string;
  name: string;
  body_text?: string;
  state: string;
  created_at: string;
}

export default function AdminAgreementsPage() {
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<AgreementTemplate | null>(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorFont, setEditorFont] = useState('system-ui, sans-serif');
  const [editorFontSize, setEditorFontSize] = useState('14px');
  const [savingEdit, setSavingEdit] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', body_text: '', state: 'published' });
  const [savingCreate, setSavingCreate] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  const SAMPLE_BODY = `
<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
  የቅጥር ውል ስምምነት (EMPLOYMENT AGREEMENT)
</h2>
<p style="margin-bottom: 12px;">
  ይህ የቅጥር ውል በአሰሪና ሰራተኛ አዋጅ ቁጥር 1156/2011 መሰረት የተዘጋጀ ሲሆን፣ ሰራተኛው የተሰጠውን ሙያዊ ኃላፊነት በታማኝነትና በትጋት ለማከናወን ተስማምቷል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  1. የስራ መደብ እና ኃላፊነት (Duties & Position)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  ሰራተኛው በተሰጠው የሥራ ዝርዝር መሠረት ሙያዊ ግዴታውን በታማኝነት እና በጥራት ያከናውናል።
</p>
<h3 style="font-size: 14px; font-weight: bold; margin-top: 14px; margin-bottom: 6px;">
  2. ደመወዝ እና የጡረታ መዋጮ (Compensation & Pension)
</h3>
<p style="margin-bottom: 12px; color: #4b5563;">
  የሰራተኛው ወርሃዊ ደመወዝ በሕግ በተደነገገው መሠረት የሚከፈል ሲሆን 7% የሰራተኛ እና 11% የአሰሪ የጡረታ መዋጮ ተቀናሽ ተደርጎ በወቅቱ ለመንግስት ገቢ ይደረጋል።
</p>
<div style="display: flex; justify-content: space-between; margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
  <div><strong>አሰሪ (Employer):</strong> ______________________</div>
  <div><strong>ሰራተኛ (Employee):</strong> ______________________</div>
</div>
`;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.templates) setTemplates(data.templates);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const handleOpenEditor = (tmpl: AgreementTemplate) => {
    setEditingTemplate(tmpl);
    setEditorHtml(tmpl.body_text || SAMPLE_BODY);
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
    }
  };

  const handleSaveEditedTemplate = async () => {
    if (!editingTemplate) return;
    setSavingEdit(true);
    const content = editorRef.current ? editorRef.current.innerHTML : editorHtml;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingTemplate.id,
          name: editingTemplate.name,
          body_text: content,
          state: editingTemplate.state,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update template');
      toast.success('Agreement template updated with Word-style formatting!');
      setEditingTemplate(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error saving template');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name) { toast.error('Template name required'); return; }
    setSavingCreate(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      toast.success('Agreement template created');
      setCreateOpen(false);
      setForm({ name: '', body_text: '', state: 'published' });
      load();
    } catch { toast.error('Network error'); } finally { setSavingCreate(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Legal Agreement Templates (Word Editor)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin can edit published agreement templates with full font and formatting options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-7 text-xs gap-1.5">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Template
          </Button>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System default */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 mb-1">
                System · Published
              </Badge>
              <CardTitle className="text-sm font-semibold">Standard Ethiopian Employment Agreement</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Labour Proclamation No. 1156/2019 · Amharic + English
              </CardDescription>
            </div>
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground line-clamp-3">
              የቅጥር ውል ስምምነት — በአሰሪና ሰራተኛ አዋጅ ቁጥር 1156/2011 መሰረት የተዘጋጀ። Statutory pension and 2025 income tax deductions.
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() =>
                  handleOpenEditor({
                    id: 'default',
                    name: 'Standard Ethiopian Employment Agreement',
                    body_text: SAMPLE_BODY,
                    state: 'published',
                    created_at: '',
                  })
                }
              >
                <Edit3 className="w-3 h-3" />
                Edit with Word Editor
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()} className="h-7 text-xs gap-1.5">
                <Printer className="w-3 h-3" />
                Print
              </Button>
            </div>
          </CardContent>
        </Card>

        {templates.map((tmpl) => (
          <Card key={tmpl.id} className="border-border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <Badge variant="outline" className="text-[10px] mb-1 capitalize">{tmpl.state}</Badge>
                <CardTitle className="text-sm font-semibold">{tmpl.name}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {tmpl.created_at ? new Date(tmpl.created_at).toLocaleDateString() : 'Active template'}
                </CardDescription>
              </div>
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground line-clamp-3">
                {tmpl.body_text ? tmpl.body_text.replace(/<[^>]*>?/gm, '') : 'No preview available'}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleOpenEditor(tmpl)}>
                  <Edit3 className="w-3 h-3" />
                  Edit with Word Editor
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FULL WORD-STYLE EDITOR MODAL FOR ADMIN */}
      {editingTemplate && (
        <Dialog open={Boolean(editingTemplate)} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-semibold">
                    Word-Type Agreement Editor — {editingTemplate.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Edit published agreement document with typography styling, font selection, and Amharic support.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label className="text-xs">Agreement Document Title</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="h-8 text-xs font-semibold"
                />
              </div>

              {/* Word-Style Toolbar */}
              <div className="p-2 border border-border rounded-lg bg-muted/40 flex flex-wrap items-center gap-2 text-xs">
                {/* Font Selector */}
                <select
                  value={editorFont}
                  onChange={(e) => setEditorFont(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="system-ui, sans-serif">Default Sans-Serif</option>
                  <option value="Georgia, serif">Serif (Georgia)</option>
                  <option value="'Courier New', monospace">Monospace (Courier)</option>
                  <option value="'Abyssinica SIL', 'Nyala', sans-serif">Amharic / Ethiopic (Abyssinica)</option>
                </select>

                {/* Font Size Selector */}
                <select
                  value={editorFontSize}
                  onChange={(e) => setEditorFontSize(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="12px">12px (Small)</option>
                  <option value="14px">14px (Normal)</option>
                  <option value="16px">16px (Medium)</option>
                  <option value="18px">18px (Large)</option>
                  <option value="22px">22px (Heading)</option>
                </select>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={() => executeCommand('bold')} className="h-8 w-8 p-0" title="Bold">
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('italic')} className="h-8 w-8 p-0" title="Italic">
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('underline')} className="h-8 w-8 p-0" title="Underline">
                  <Underline className="w-3.5 h-3.5" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={() => executeCommand('justifyLeft')} className="h-8 w-8 p-0" title="Left">
                  <AlignLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('justifyCenter')} className="h-8 w-8 p-0" title="Center">
                  <AlignCenter className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('justifyRight')} className="h-8 w-8 p-0" title="Right">
                  <AlignRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('justifyFull')} className="h-8 w-8 p-0" title="Justify">
                  <AlignJustify className="w-3.5 h-3.5" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={() => executeCommand('insertUnorderedList')} className="h-8 w-8 p-0" title="Bullets">
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => executeCommand('insertOrderedList')} className="h-8 w-8 p-0" title="Numbers">
                  <ListOrdered className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Editable Paper View */}
              <div className="p-6 bg-muted/20 border border-border rounded-lg flex justify-center">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  style={{
                    fontFamily: editorFont,
                    fontSize: editorFontSize,
                    minHeight: '400px',
                    width: '100%',
                    maxWidth: '750px',
                  }}
                  className="bg-background border border-border p-6 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: editorHtml }}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)} className="text-xs h-8">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEditedTemplate} disabled={savingEdit} className="text-xs h-8 gap-1.5 shadow-xs">
                <Save className="w-3.5 h-3.5" />
                {savingEdit ? 'Saving...' : 'Save Published Agreement'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Create Agreement Template</DialogTitle>
            <DialogDescription className="text-xs">Add a new legal template with Amharic Unicode support.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name *</Label>
              <Input
                placeholder="e.g. Sales Representative Contract"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Initial Body Content</Label>
              <textarea
                rows={8}
                value={form.body_text}
                onChange={(e) => setForm((p) => ({ ...p, body_text: e.target.value }))}
                placeholder="Enter agreement terms in Amharic or English..."
                className="w-full text-xs p-2 rounded-md border border-border bg-background font-mono resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="text-xs h-8">Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={savingCreate} className="text-xs h-8">
              {savingCreate ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
