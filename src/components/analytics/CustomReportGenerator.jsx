import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Calendar } from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';

export default function CustomReportGenerator({ user }) {
  const [reportConfig, setReportConfig] = useState({
    dateRange: '30',
    includeReferrals: true,
    includeEarnings: true,
    includeCampaigns: true,
    includeAchievements: false,
    includeABTests: false,
    format: 'csv'
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-report', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id })
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts-report', user.id],
    queryFn: () => base44.entities.ReferralPayout.filter({ user_id: user.id })
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns-report', user.id],
    queryFn: () => base44.entities.ReferralCampaign.filter({ user_id: user.id })
  });

  const generateReport = () => {
    const startDate = moment().subtract(parseInt(reportConfig.dateRange), 'days');
    const filteredReferrals = referrals.filter(r => moment(r.created_date).isAfter(startDate));
    
    let reportContent = `REFERRAL PERFORMANCE REPORT\n`;
    reportContent += `Generated: ${moment().format('YYYY-MM-DD HH:mm')}\n`;
    reportContent += `Period: Last ${reportConfig.dateRange} days\n`;
    reportContent += `User: ${user.full_name} (${user.email})\n\n`;
    reportContent += `=${'='.repeat(60)}=\n\n`;

    if (reportConfig.includeReferrals) {
      reportContent += `REFERRALS SUMMARY\n`;
      reportContent += `Total Referrals: ${filteredReferrals.length}\n`;
      reportContent += `Active: ${filteredReferrals.filter(r => r.status === 'active').length}\n`;
      reportContent += `Converted: ${filteredReferrals.filter(r => r.status === 'converted').length}\n\n`;
      
      reportContent += `REFERRAL DETAILS:\n`;
      filteredReferrals.forEach((ref, i) => {
        reportContent += `${i+1}. ${ref.referral_type} - ${ref.status} - ${moment(ref.created_date).format('YYYY-MM-DD')}\n`;
      });
      reportContent += `\n`;
    }

    if (reportConfig.includeEarnings) {
      const totalEarnings = payouts.reduce((sum, p) => sum + (p.net_amount || 0), 0);
      reportContent += `EARNINGS SUMMARY\n`;
      reportContent += `Total Earnings: $${totalEarnings.toFixed(2)}\n`;
      reportContent += `Pending Payouts: ${payouts.filter(p => p.status === 'pending').length}\n`;
      reportContent += `Completed Payouts: ${payouts.filter(p => p.status === 'completed').length}\n\n`;
    }

    if (reportConfig.includeCampaigns) {
      reportContent += `CAMPAIGNS\n`;
      campaigns.forEach((campaign, i) => {
        reportContent += `${i+1}. ${campaign.campaign_name}\n`;
        reportContent += `   Type: ${campaign.campaign_type}\n`;
        reportContent += `   Clicks: ${campaign.total_clicks}\n`;
        reportContent += `   Conversions: ${campaign.total_conversions}\n`;
        reportContent += `   Conv Rate: ${campaign.conversion_rate}%\n`;
        reportContent += `   Earned: $${campaign.total_earned.toFixed(2)}\n\n`;
      });
    }

    reportContent += `=${'='.repeat(60)}=\n`;
    reportContent += `End of Report\n`;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-report-${moment().format('YYYY-MM-DD')}.txt`;
    a.click();
    
    toast.success('Report downloaded!');
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Custom Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Date Range</Label>
            <Select value={reportConfig.dateRange} onValueChange={(v) => setReportConfig({...reportConfig, dateRange: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="9999">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Include in Report</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={reportConfig.includeReferrals}
                  onCheckedChange={(c) => setReportConfig({...reportConfig, includeReferrals: c})}
                />
                <Label className="font-normal">Referral Statistics</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={reportConfig.includeEarnings}
                  onCheckedChange={(c) => setReportConfig({...reportConfig, includeEarnings: c})}
                />
                <Label className="font-normal">Earnings & Payouts</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={reportConfig.includeCampaigns}
                  onCheckedChange={(c) => setReportConfig({...reportConfig, includeCampaigns: c})}
                />
                <Label className="font-normal">Campaign Performance</Label>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={generateReport} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
          <Download className="w-4 h-4 mr-2" />
          Generate & Download Report
        </Button>
      </CardContent>
    </Card>
  );
}