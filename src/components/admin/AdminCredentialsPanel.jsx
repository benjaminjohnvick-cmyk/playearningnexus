import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Plus, Trash2, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default function AdminCredentialsPanel() {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', label: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: creds = [] } = useQuery({
    queryKey: ['admin_credentials'],
    queryFn: () => base44.entities.AdminCredential.list('-created_date')
  });

  const handleCreate = async () => {
    if (!form.username || !form.password) return toast.error('Username and password required');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (creds.find(c => c.username === form.username)) return toast.error('Username already exists');

    setSaving(true);
    const hash = await sha256(form.password);
    await base44.entities.AdminCredential.create({
      username: form.username,
      password_hash: hash,
      label: form.label || form.username,
      is_active: true
    });
    toast.success('Admin credential created');
    setForm({ username: '', password: '', confirmPassword: '', label: '' });
    qc.invalidateQueries({ queryKey: ['admin_credentials'] });
    setSaving(false);
  };

  const handleToggle = async (cred) => {
    await base44.entities.AdminCredential.update(cred.id, { is_active: !cred.is_active });
    qc.invalidateQueries({ queryKey: ['admin_credentials'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this credential?')) return;
    await base44.entities.AdminCredential.delete(id);
    qc.invalidateQueries({ queryKey: ['admin_credentials'] });
    toast.success('Credential deleted');
  };

  const handleChangePassword = async (cred) => {
    const newPass = prompt('Enter new password (min 8 chars):');
    if (!newPass || newPass.length < 8) return toast.error('Password too short');
    const hash = await sha256(newPass);
    await base44.entities.AdminCredential.update(cred.id, { password_hash: hash });
    toast.success('Password updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="text-xl font-bold text-gray-900">Admin Panel Credentials</h3>
          <p className="text-sm text-gray-500">Manage username/password pairs for admin dashboard access</p>
        </div>
      </div>

      {/* Create Form */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Add New Credential</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <Input placeholder="Label (e.g. 'Main Admin')" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            <Input placeholder="Username" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            <div className="relative">
              <Input type={showPass ? 'text' : 'password'} placeholder="Password (min 8 chars)"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <button onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input type="password" placeholder="Confirm password"
              value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Create Credential
          </Button>
        </CardContent>
      </Card>

      {/* Existing Credentials */}
      <div className="space-y-3">
        {creds.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-gray-400">
            <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No admin credentials set up yet</p>
          </CardContent></Card>
        ) : creds.map(cred => (
          <Card key={cred.id} className={`border-2 ${cred.is_active ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cred.label || cred.username}</p>
                  <p className="text-sm text-gray-500">@{cred.username}</p>
                  {cred.last_login && <p className="text-xs text-gray-400">Last login: {new Date(cred.last_login).toLocaleDateString()}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cred.is_active ? 'default' : 'secondary'}>{cred.is_active ? 'Active' : 'Disabled'}</Badge>
                <Button size="sm" variant="outline" onClick={() => handleChangePassword(cred)}>Change Password</Button>
                <Button size="sm" variant="outline" onClick={() => handleToggle(cred)}
                  className={cred.is_active ? 'text-orange-600 border-orange-300' : 'text-green-600 border-green-300'}>
                  {cred.is_active ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(cred.id)} className="text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <p className="text-sm text-amber-800 font-medium">🔒 Security Note</p>
          <p className="text-xs text-amber-700 mt-1">Passwords are hashed with SHA-256 before storage. These credentials are separate from your Base44 account login and are used for an additional layer of admin panel access control.</p>
        </CardContent>
      </Card>
    </div>
  );
}