import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Twitter, Instagram, Facebook, Linkedin, Video, Share2, DollarSign, Trophy, Building2, User as UserIcon, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_META = {
  twitter: { label: 'Twitter / X', icon: Twitter, color: 'text-sky-500' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  tiktok: { label: 'TikTok', icon: Video, color: 'text-gray-900' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
};

export default function WeeklyReferralContest() {
  const [user, setUser] = useState(null);
  const [postUrl, setPostUrl] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['activeReferralCampaign'],
    queryFn: async () => {
      const rows = await base44.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
      return rows[0] || null;
    },
    enabled: !!user,
  });

  const { data: myEntries = [] } = useQuery({
    queryKey: ['myReferralEntries', campaign?.id, user?.id],
    queryFn: () => base44.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: user.id }),
    enabled: !!campaign && !!user,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.functions.invoke('submitReferralPost', { post_url: postUrl, referral_code: user?.referral_code }),
    onSuccess: (res) => {
      const d = res?.data || {};
      const extra = d.doubled ? ` (doubled: ${d.remaining} more on ${d.platform})` : d.remaining ? ` (${d.remaining} more required)` : '';
      toast.success(`Post logged! $${Number(d.reward_pending || 0.1).toFixed(2)} pending — credited on your next survey.${extra}`);
      setPostUrl('');
      qc.invalidateQueries({ queryKey: ['myReferralEntries'] });
      qc.invalidateQueries({ queryKey: ['activeReferralCampaign'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not log your post.'),
  });

  if (!user || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  const meta = campaign ? (PLATFORM_META[campaign.platform] || PLATFORM_META.twitter) : null;
  const PlatformIcon = meta?.icon || Share2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Share2 className="w-4 h-4" /> Weekly Referral Prize Pool
          </div>
          <h1 className="text-3xl font-black text-gray-900">Post your referral, get paid</h1>
          <p className="text-gray-500 mt-1">A new platform every week. $0.10 per post + standard commission on conversions.</p>
        </div>

        {!campaign ? (
          <Card><CardContent className="py-16 text-center text-gray-500">
            <Share2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No active campaign right now.</p>
            <p className="text-sm mt-1">A new one opens every week — check back soon.</p>
          </CardContent></Card>
        ) : (
          <>
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><PlatformIcon className={`w-6 h-6 ${meta.color}`} /> This week: {meta.label}</span>
                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><DollarSign className="w-3 h-3" />0.10 / post</Badge>
                </CardTitle>
                <p className="text-sm text-gray-500">{campaign.title}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">Participation is optional. If you skip a week, next week you can earn a <strong>double bonus</strong> by posting on your best-performing platform. Posts must include an <strong>#ad</strong> disclosure to stay FTC-compliant.</p>
                </div>

                {myEntries.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700 font-medium"><CheckCircle2 className="w-5 h-5" /> You've logged {myEntries.length} post{myEntries.length > 1 ? 's' : ''} this week.</div>
                    {myEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="truncate max-w-[60%]">{e.post_url}</span>
                        <Badge variant={e.reward_credited ? 'default' : 'secondary'} className="text-xs">
                          {e.reward_credited ? 'credited' : 'pending → next survey'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Paste the link to your post</label>
                  <div className="flex gap-2">
                    <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder={`https://${campaign.platform}.com/your-post`} className="flex-1" />
                    <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!postUrl || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                      {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">Your $0.10 is held pending and credited the next time you complete a survey. Real conversions still earn your standard 5% affiliate commission.</p>
                </div>
              </CardContent>
            </Card>

            {(campaign.leaderboard_user?.length > 0 || campaign.leaderboard_business?.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                <LeaderboardCard title="User Referrers" icon={UserIcon} rows={campaign.leaderboard_user} />
                <LeaderboardCard title="Business Referrers" icon={Building2} rows={campaign.leaderboard_business} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LeaderboardCard({ title, icon: Icon, rows = [] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4" /> {title} <Trophy className="w-4 h-4 text-yellow-500 ml-auto" /></CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No entries yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.slice(0, 10).map((r, i) => (
              <div key={r.user_id || i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><span className="w-5 text-gray-400">{i + 1}.</span>{r.user_name || 'Member'}</span>
                <span className="text-gray-500">{r.conversions || 0} conv · {r.posts || 0} posts</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
