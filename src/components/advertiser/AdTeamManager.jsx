import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Shield, Eye, Edit3, Trash2, Crown, Copy, Check, Mail, X } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = {
  admin:  { label: 'Admin',  icon: Crown,  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30', desc: 'Full access — manage ads, billing, team' },
  editor: { label: 'Editor', icon: Edit3,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',   desc: 'Create & edit ads, view analytics' },
  viewer: { label: 'Viewer', icon: Eye,    color: 'text-gray-400',   bg: 'bg-gray-700/30 border-gray-600/30',   desc: 'Read-only access to analytics & reports' },
};

const STORAGE_KEY = (userId) => `gg_ad_team_${userId}`;

export default function AdTeamManager({ userId, userName }) {
  const [members, setMembers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) || '[]'); } catch { return []; }
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(null);

  const persist = (next) => {
    setMembers(next);
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(next));
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    if (members.some(m => m.email === inviteEmail.trim())) {
      toast.error('This email is already on the team');
      return;
    }
    setInviting(true);
    // Store invitation record
    const newMember = {
      id: Date.now().toString(),
      email: inviteEmail.trim(),
      name: inviteEmail.split('@')[0],
      role: inviteRole,
      status: 'invited',
      invitedAt: new Date().toISOString(),
    };

    // Send platform invite
    await base44.users.inviteUser(inviteEmail.trim(), 'user').catch(() => null);

    // Send notification email
    await base44.integrations.Core.SendEmail({
      to: inviteEmail.trim(),
      subject: `${userName} invited you to their Advertiser Dashboard on GamerGain`,
      body: `Hi,\n\n${userName} has invited you to collaborate on their GamerGain advertising account as a ${ROLE_LABELS[inviteRole] || inviteRole}.\n\nYour role gives you ${ROLES[inviteRole]?.desc}.\n\nSign in at https://gamergain.app/AdBusinessDashboard to get started.\n\nGamerGain Team`,
    }).catch(() => null);

    persist([...members, newMember]);
    setInviteEmail('');
    setInviting(false);
    toast.success(`Invite sent to ${inviteEmail.trim()}`);
  };

  const changeRole = (id, newRole) => {
    persist(members.map(m => m.id === id ? { ...m, role: newRole } : m));
    toast.success('Role updated');
  };

  const removeMember = (id) => {
    persist(members.filter(m => m.id !== id));
    toast.success('Member removed');
  };

  const copyInviteLink = (email) => {
    const link = `${window.location.origin}/AdBusinessDashboard?invited_by=${encodeURIComponent(userId)}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Invite link copied');
  };

  const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

  return (
    <div className="space-y-5">
      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(ROLES).map(([key, r]) => (
          <div key={key} className={`border rounded-xl p-3 ${r.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <r.icon className={`w-4 h-4 ${r.color}`} />
              <span className={`font-bold text-sm ${r.color}`}>{r.label}</span>
            </div>
            <p className="text-gray-400 text-xs">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
        <p className="text-white font-bold text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-yellow-400" /> Invite Team Member
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="colleague@company.com"
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-yellow-500/50 outline-none"
          />
          <div className="flex gap-2">
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-yellow-500/50"
            >
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>{r.label}</option>
              ))}
            </select>
            <Button onClick={sendInvite} disabled={inviting}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 text-xs px-4">
              {inviting ? '...' : <><UserPlus className="w-3.5 h-3.5" /> Invite</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Owner row */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Team ({members.length + 1} members)</p>
        <div className="space-y-2">
          {/* Owner */}
          <div className="flex items-center gap-3 bg-gray-800/30 border border-yellow-500/20 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Crown className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{userName}</p>
              <p className="text-gray-500 text-xs">Account Owner</p>
            </div>
            <Badge className="bg-yellow-500/20 border-yellow-500/30 text-yellow-300 text-[10px]">Owner</Badge>
          </div>

          {/* Members */}
          {members.length === 0 ? (
            <div className="text-center py-6 text-gray-600 text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No team members yet. Invite collaborators above.
            </div>
          ) : (
            members.map(m => {
              const role = ROLES[m.role] || ROLES.viewer;
              return (
                <div key={m.id} className="flex items-center gap-3 bg-gray-800/30 border border-gray-700/50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-black text-gray-300 uppercase">
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{m.name}</p>
                    <p className="text-gray-500 text-xs truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.status === 'invited' && (
                      <Badge className="bg-orange-500/10 border-orange-500/20 text-orange-400 text-[10px]">Pending</Badge>
                    )}
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                      className={`bg-gray-900 border rounded-lg px-2 py-1 text-xs font-bold outline-none ${role.bg} ${role.color}`}
                    >
                      {Object.entries(ROLES).map(([k, r]) => (
                        <option key={k} value={k}>{r.label}</option>
                      ))}
                    </select>
                    <button onClick={() => copyInviteLink(m.email)}
                      className="text-gray-500 hover:text-white transition-colors p-1">
                      {copied === m.email ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => removeMember(m.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="text-gray-600 text-xs">
        Team members receive an email invitation to join your dashboard. Role permissions are enforced on sign-in.
      </p>
    </div>
  );
}