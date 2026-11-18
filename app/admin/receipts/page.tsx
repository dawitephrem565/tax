'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Receipt, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptRecord {
  id: string;
  company_id: string;
  company_name?: string;
  fs_number: string;
  machine_number: string;
  receipt_type: 'purchase' | 'sale';
  partner_name: string;
  partner_tin: string;
  untaxed_amount: number;
  vat_15: number;
  wht_3: number;
  total_amount: number;
  state: string;
  receipt_date: string;
  created_at: string;
}

export default function AdminReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sale'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    fs_number: '', machine_number: '', receipt_type: 'purchase' as 'purchase' | 'sale',
    partner_name: '', partner_tin: '', untaxed_amount: 0,
  });
  const [saving, setSaving] = useState(false);

  const vat = Math.round(form.untaxed_amount * 0.15);
  const wht = form.receipt_type === 'purchase' ? Math.round(form.untaxed_amount * 0.03) : 0;
  const total = form.untaxed_amount + vat;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/receipts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.receipts) setReceipts(data.receipts);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.fs_number || !form.partner_name) {
      toast.error('FS Number and partner name are required'); return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, vat_15: vat, wht_3: wht, total_amount: total }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save receipt'); return; }
      toast.success('Receipt registered');
      setModalOpen(false);
      setForm({ fs_number: '', machine_number: '', receipt_type: 'purchase', partner_name: '', partner_tin: '', untaxed_amount: 0 });
      load();
    } catch { toast.error('Network error'); } finally { setSaving(false); }
  };

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch = r.fs_number.toLowerCase().includes(q) || r.partner_name.toLowerCase().includes(q) || (r.partner_tin || '').includes(q);
    const matchesType = typeFilter === 'all' || r.receipt_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalVAT = filtered.reduce((s, r) => s + (r.vat_15 || 0), 0);
  const totalWHT = filtered.reduce((s, r) => s + (r.wht_3 || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Receipt Intake — All Companies</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dual-image fiscal receipts with FS/Machine duplicate check, 15% VAT & 3% WHT (Odoo ethiopia.receipt.intake).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-7 text-xs gap-1.5">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Receipt
          </Button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Total Receipts</span>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Total 15% VAT</span>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">{totalVAT.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Total 3% WHT</span>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold">{totalWHT.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ETB</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">Registered Receipts</CardTitle>
            <CardDescription className="text-xs">FS Number & Machine Number duplicate detection active.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="FS, partner, TIN..." className="h-7 pl-8 text-xs" />
            </div>
            <div className="flex rounded-md border border-border p-0.5 bg-muted/40">
              {(['all', 'purchase', 'sale'] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 text-xs rounded capitalize font-medium transition-colors ${typeFilter === t ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Company</TableHead>
                <TableHead>FS Number</TableHead>
                <TableHead>Machine No.</TableHead>
                <TableHead>Partner / TIN</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Untaxed</TableHead>
                <TableHead>15% VAT</TableHead>
                <TableHead>3% WHT</TableHead>
                <TableHead>Total (ETB)</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-xs text-muted-foreground">Loading receipts...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-xs text-muted-foreground">No receipts found. Register the first receipt.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium max-w-[140px] truncate">{r.company_name || '—'}</TableCell>
                  <TableCell className="font-mono">{r.fs_number}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{r.machine_number || '—'}</TableCell>
                  <TableCell>
                    <span className="font-medium">{r.partner_name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{r.partner_tin || '—'}</span>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{r.receipt_type}</Badge></TableCell>
                  <TableCell>{(r.untaxed_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-blue-600 dark:text-blue-400">+{(r.vat_15 || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-amber-600 dark:text-amber-400">-{(r.wht_3 || 0).toLocaleString()}</TableCell>
                  <TableCell className="font-bold">{(r.total_amount || 0).toLocaleString()} ETB</TableCell>
                  <TableCell className="text-muted-foreground">{r.receipt_date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Receipt Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Register New Receipt</DialogTitle>
            <DialogDescription className="text-xs">FS Number and Machine Number will be checked for duplicates.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Receipt Type</Label>
              <Select value={form.receipt_type} onValueChange={(v) => setForm((p) => ({ ...p, receipt_type: v as 'purchase' | 'sale' }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase" className="text-xs">Purchase</SelectItem>
                  <SelectItem value="sale" className="text-xs">Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {[
              { key: 'fs_number', label: 'FS Number *', placeholder: 'FS-2026-9041' },
              { key: 'machine_number', label: 'Machine Number', placeholder: 'ERCA-POS-0842' },
              { key: 'partner_name', label: 'Partner Name *', placeholder: 'National Trading PLC' },
              { key: 'partner_tin', label: 'Partner TIN', placeholder: '0012938475' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input placeholder={placeholder} value={(form as any)[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="h-9 text-xs" />
              </div>
            ))}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Untaxed Amount (ETB)</Label>
              <Input type="number" placeholder="10000" value={form.untaxed_amount || ''} onChange={(e) => setForm((p) => ({ ...p, untaxed_amount: parseFloat(e.target.value) || 0 }))} className="h-9 text-xs" />
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border border-border text-xs">
              <div><p className="text-muted-foreground">15% VAT</p><p className="font-bold">{vat.toLocaleString()} ETB</p></div>
              <div><p className="text-muted-foreground">3% WHT</p><p className="font-bold">{wht.toLocaleString()} ETB</p></div>
              <div><p className="text-muted-foreground">Total</p><p className="font-bold">{total.toLocaleString()} ETB</p></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="text-xs h-8">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs h-8">{saving ? 'Saving...' : 'Register Receipt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

