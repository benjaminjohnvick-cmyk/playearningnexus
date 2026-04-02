import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Search, User, Clock, Shield, AlertTriangle } from 'lucide-react';

const ACTION_COLORS = {
  create_credential: 'bg-blue-100 text-blue-800',
  delete_credential: 'bg-red-100 text-red-800',
  change_password: 'bg-orange-100 text-orange-800',
  toggle_credential: 'bg-yellow-100 text-yellow-800',
  update_user: 'bg-purple-100 text-purple-800',
  impersonate_user: 'bg-pink-100 text-pink-800',
  exit_impersonation: 'bg-gray-100 text-gray-800',
  update_global_settings: 'bg-green-100 text-green-800',
  toggle_maintenance_mode: 'bg-orange-100 text-orange-800',
  update_branding: 'bg-indigo-100 text-indigo-800',
  update_notification_prefs: 'bg-teal-100 text-teal-800',
  other: 'bg-gray-100 text-gray-700',
};

const ACTION_LABELS = {
  create_credential: '➕ Create Credential',
  delete_credential: '🗑️ Delete Credential',
  change_password: '🔑 Change Password',
  toggle_credential: '🔀 Toggle Credential',
  update_user: '✏️ Update User',
  impersonate_user: '👤 Impersonate User',
  exit_impersonation: '🚪 Exit Impersonation',
  update_global_settings: '⚙️ Update Settings',
  toggle_maintenance_mode: '🚧 Maintenance Mode',
  update_branding: '🎨 Update Branding',
  update_notification_prefs: '🔔 Notification Prefs',
  other: '📌 Other',
};

export default function AdminAuditLogs() {
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setCurrentUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin_audit_logs'],
    queryFn: () => base44.entities.AdminAuditLog.list('-timestamp', 500),
    enabled: !!currentUser,
    refetchInterval: 30000
  });

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.target?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === 'all' || log.action_type === filterAction;
    return matchSearch && matchAction;
  });

  if (!currentUser) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-10 h-10 text-red-600" />
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Admin Audit Logs</h1>
            <p className="text-gray-500">{logs.length} total logged actions</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-2 border-red-200 bg-white">
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-48">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <Input placeholder="Search by actor, target, or details..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">{filtered.length} results</Badge>
          </CardContent>
        </Card>

        {/* Log Entries */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No audit log entries found</p>
              <p className="text-sm mt-1">Sensitive admin actions will appear here automatically</p>
            </CardContent></Card>
          ) : filtered.map((log, i) => (
            <Card key={log.id || i} className="border border-gray-200 hover:border-red-300 transition-colors">
              <CardContent className="p-4 flex flex-wrap items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className={ACTION_COLORS[log.action_type] || 'bg-gray-100 text-gray-700'}>
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </Badge>
                    {log.target && (
                      <span className="text-sm font-medium text-gray-700 truncate">→ {log.target}</span>
                    )}
                  </div>
                  {log.details && <p className="text-sm text-gray-600">{log.details}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.actor_email || 'Unknown'}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.timestamp ? new Date(log.timestamp).toLocaleString() : new Date(log.created_date).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}