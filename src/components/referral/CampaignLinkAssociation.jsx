import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Link2, Plus, X, MousePointerClick, TrendingUp } from 'lucide-react';

export default function CampaignLinkAssociation({ campaign, user }) {
  const qc = useQueryClient();

  const { data: allLinks = [] } = useQuery({
    queryKey: ['referralLinks', user.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date', 50),
  });

  const linkedIds = campaign.referral_links || [];
  const linkedLinks = allLinks.filter(l => linkedIds.includes(l.id));
  const unlinkedLinks = allLinks.filter(l => !linkedIds.includes(l.id));

  const attachMutation = useMutation({
    mutationFn: async (linkId) => {
      // Update link with campaign_id
      await base44.entities.CustomReferralLink.update(linkId, { campaign_id: campaign.id });
      // Update campaign's referral_links array
      const newIds = [...linkedIds, linkId];
      await base44.entities.ReferralCampaign.update(campaign.id, { referral_links: newIds });
    },
    onSuccess: () => {
      qc.invalidateQueries(['campaigns']);
      qc.invalidateQueries(['referralLinks', user.id]);
    },
  });

  const detachMutation = useMutation({
    mutationFn: async (linkId) => {
      await base44.entities.CustomReferralLink.update(linkId, { campaign_id: '' });
      const newIds = linkedIds.filter(id => id !== linkId);
      await base44.entities.ReferralCampaign.update(campaign.id, { referral_links: newIds });
    },
    onSuccess: () => {
      qc.invalidateQueries(['campaigns']);
      qc.invalidateQueries(['referralLinks', user.id]);
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
        <Link2 className="w-4 h-4 text-purple-600" /> Linked Referral Links
      </p>

      {linkedLinks.length === 0 && (
        <p className="text-xs text-gray-400">No links attached yet. Add from your available links below.</p>
      )}

      <div className="space-y-2">
        {linkedLinks.map(link => (
          <div key={link.id} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
            <div>
              <span className="text-xs font-mono text-blue-700 font-semibold">{link.link_code}</span>
              {link.campaign_name && <span className="ml-2 text-xs text-gray-500">{link.campaign_name}</span>}
              <span className="ml-3 text-xs text-gray-400 capitalize">{link.referral_source}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{link.clicks || 0}</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{link.conversions || 0}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => detachMutation.mutate(link.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {unlinkedLinks.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1 mt-2">Add existing links:</p>
          <div className="flex flex-wrap gap-2">
            {unlinkedLinks.map(link => (
              <Button
                key={link.id}
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => attachMutation.mutate(link.id)}
                disabled={attachMutation.isPending}
              >
                <Plus className="w-3 h-3 mr-1" />
                {link.link_code}{link.campaign_name ? ` · ${link.campaign_name}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}