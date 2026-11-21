import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  Edit,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { PrintClient, PrintOrder, WORK_STATUS_META } from '../types/printdesk';
import { formatDateTimeId, formatRupiah, generateSafeId } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';

interface ClientsViewProps {
  clients: PrintClient[];
  orders: PrintOrder[];
  ownerId: string;
  onSaveClient: (client: PrintClient, isNew: boolean) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onOpenOrderDetail: (orderId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  orders,
  ownerId,
  onSaveClient,
  onDeleteClient,
  onOpenOrderDetail,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    clients[0]?.id || null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<PrintClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrintClient | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || filteredClients[0] || null,
    [clients, selectedClientId, filteredClients]
  );

  const clientStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; totalSpend: number; list: PrintOrder[] }>();
    for (const o of orders) {
      const key = o.clientId || o.clientName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { count: 0, totalSpend: 0, list: [] });
      }
      const entry = map.get(key)!;
      entry.count++;
      entry.totalSpend += o.totalPrice;
      entry.list.push(o);
    }
    return map;
  }, [orders]);

  const getOrdersForClient = (client: PrintClient): PrintOrder[] => {
    const byId = clientStatsMap.get(client.id)?.list || [];
    if (byId.length > 0) return byId;
    return orders.filter(
      (o) =>
        o.clientName.toLowerCase() === client.name.toLowerCase() ||
        (client.phone && o.clientPhone === client.phone)
    );
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setEmail('');
    setCompany('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (client: PrintClient) => {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone);
    setEmail(client.email || '');
    setCompany(client.company || '');
    setNotes(client.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: PrintClient = {
        id: editingClient?.id || generateSafeId('cli'),
        ownerId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company.trim(),
        notes: notes.trim(),
        createdAtIso: editingClient?.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      };
      await onSaveClient(payload, !editingClient);
      setSelectedClientId(payload.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const selectedOrders = selectedClient ? getOrdersForClient(selectedClient) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama client, HP, perusahaan..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Tambah Client
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Client Directory List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Daftar Client ({filteredClients.length})
          </div>
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              Belum ada client yang sesuai.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
              {filteredClients.map((client) => {
                const cOrders = getOrdersForClient(client);
                const totalSpend = cOrders.reduce((s, o) => s + o.totalPrice, 0);
                const active = selectedClient?.id === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      active
                        ? 'bg-orange-50/70 dark:bg-orange-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {client.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {client.phone}
                          {client.company ? ` · ${client.company}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {cOrders.length} order
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatRupiah(totalSpend)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Client Detail & Order History */}
        <div className="lg:col-span-7">
          {!selectedClient ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              Pilih salah satu client di sebelah kiri untuk melihat detail kontak dan riwayat order.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedClient.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{selectedClient.phone}</span>
                    </div>
                    {selectedClient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedClient.email}</span>
                      </div>
                    )}
                    {selectedClient.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedClient.company}</span>
                      </div>
                    )}
                  </div>
                  {selectedClient.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      {selectedClient.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedClient)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedClient)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Riwayat Order ({selectedOrders.length})
                </h4>
                {selectedOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belum ada transaksi order dari client ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {selectedOrders.map((ord) => {
                      const wMeta = WORK_STATUS_META[ord.workStatus];
                      return (
                        <div
                          key={ord.id}
                          className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                {ord.orderCode}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-medium ${wMeta.colorClass}`}
                              >
                                {wMeta.shortLabel}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                              {ord.printType}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400">
                              {formatDateTimeId(ord.createdAtIso)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right font-mono tabular-nums">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {formatRupiah(ord.totalPrice)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Sisa {formatRupiah(ord.remainingAmount)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenOrderDetail(ord.id)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Buka detail order"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingClient ? 'Edit Data Client' : 'Tambah Client Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Client *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor HP / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instansi / Perusahaan
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Data Client?"
        description={`Data client "${deleteTarget?.name}" akan dihapus dari direktori. Order yang sudah tercatat tetap aman.`}
        confirmLabel="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDeleteClient(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
