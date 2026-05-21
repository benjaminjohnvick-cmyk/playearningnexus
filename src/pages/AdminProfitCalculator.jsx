import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, BarChart2, RefreshCw } from 'lucide-react';

// ─── SURVEY PRICING CONSTANTS ───────────────────────────────────────────────
const SURVEY_COST_PER_RESPONSE = 0.95;
const MIN_RESPONSES = 3000;
const BITLABS_COST_PER_RESPONSE = 0.50; // BitLabs is cheaper (no minimum requirement)
const BITLABS_MIN = 500;
const AD_VALUE_BONUS = 12000; // $12,000 in AI ads value included

// Platform commission on referral earnings
const PLATFORM_COMMISSION_PCT = 0.15;

// Business tier prices (base)
const SURVEY_SUBSCRIPTION_ANNUAL = 2920; // 3000 * $0.95 = $2,850, rounded to $2,920 for annual plan
const FULL_SERVICE_BASE = 5000;
const ENTERPRISE_BASE = 10000;

// Affiliate platform cut
const AFFILIATE_COMMISSION_PAID_PCT = 0.10;

export default function AdminProfitCalculator() {
  const [inputs, setInputs] = useState({
    // Survey revenue
    diy_surveys_sold: 10,
    full_service_projects: 2,
    enterprise_projects: 1,
    bitlabs_responses: 5000,

    // Advertiser revenue
    daily_ad_plans: 20,
    monthly_ad_plans: 15,
    annual_ad_plans: 5,

    // Developer revenue
    developer_installs: 500,
    iap_revenue: 3000,

    // Referral earnings
    active_referrals: 200,
    avg_referral_daily_earn: 3.0,

    // Store sales
    store_gmv: 10000,

    // Operational costs
    server_costs: 800,
    payment_processing_pct: 3,
    support_staff: 2000,
    affiliate_payouts: 5000,
    bitlabs_payout_cost: 2000,
    other_expenses: 500,
  });

  const set = (k, v) => setInputs(p => ({ ...p, [k]: parseFloat(v) || 0 }));

  // ─── REVENUE CALCULATIONS ────────────────────────────────────────────────
  // Survey Revenue
  const diy_revenue = inputs.diy_surveys_sold * SURVEY_SUBSCRIPTION_ANNUAL;
  const full_service_revenue = inputs.full_service_projects * FULL_SERVICE_BASE;
  const enterprise_revenue = inputs.enterprise_projects * ENTERPRISE_BASE;
  const bitlabs_revenue = inputs.bitlabs_responses * BITLABS_COST_PER_RESPONSE;
  const survey_total_revenue = diy_revenue + full_service_revenue + enterprise_revenue + bitlabs_revenue;

  // Ad Revenue
  const ad_daily_revenue = inputs.daily_ad_plans * 8 * 30;
  const ad_monthly_revenue = inputs.monthly_ad_plans * 240;
  const ad_annual_revenue = inputs.annual_ad_plans * 2000;
  const ad_total_revenue = ad_daily_revenue + ad_monthly_revenue + ad_annual_revenue;

  // Developer Revenue
  const dev_install_revenue = inputs.developer_installs * 6; // $6 CPI
  const dev_iap_revenue = inputs.iap_revenue * 0.5; // 50% split
  const dev_total_revenue = dev_install_revenue + dev_iap_revenue;

  // Referral Platform Cut
  const referral_platform_revenue = inputs.active_referrals * inputs.avg_referral_daily_earn * 30 * PLATFORM_COMMISSION_PCT;

  // Store Revenue
  const store_revenue = inputs.store_gmv * 0.1; // 10% platform fee

  const gross_revenue = survey_total_revenue + ad_total_revenue + dev_total_revenue + referral_platform_revenue + store_revenue;

  // ─── EXPENSE CALCULATIONS ────────────────────────────────────────────────
  // Survey costs
  const survey_respondent_cost = inputs.diy_surveys_sold * MIN_RESPONSES * SURVEY_COST_PER_RESPONSE * 0.5; // We pay out 50% to respondents
  const bitlabs_payout = inputs.bitlabs_payout_cost;

  // Payment processing
  const payment_fees = gross_revenue * (inputs.payment_processing_pct / 100);

  // Affiliate payouts
  const affiliate_payouts = inputs.affiliate_payouts;

  const total_expenses = inputs.server_costs + payment_fees + inputs.support_staff +
    affiliate_payouts + survey_respondent_cost + bitlabs_payout + inputs.other_expenses;

  const net_profit = gross_revenue - total_expenses;
  const profit_margin = gross_revenue > 0 ? (net_profit / gross_revenue * 100).toFixed(1) : 0;

  // Per-DIY-survey client profit
  const revenue_per_diy_client = SURVEY_SUBSCRIPTION_ANNUAL; // what they pay
  const cost_per_diy_client = MIN_RESPONSES * SURVEY_COST_PER_RESPONSE * 0.5; // our payout cost
  const gross_per_diy = revenue_per_diy_client - cost_per_diy_client;
  // Client's value: 3000 responses * $0.95 = $2,850 of data + $12,000 ad value = $14,850 total value
  const client_data_value = MIN_RESPONSES * SURVEY_COST_PER_RESPONSE; // $2,850
  const client_total_value = client_data_value + AD_VALUE_BONUS; // $14,850
  const client_net_gain = client_total_value - SURVEY_SUBSCRIPTION_ANNUAL; // $14,850 - $2,920 = $11,930

  const InputRow = ({ label, field, prefix = '', suffix = '' }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-slate-600 flex-1">{label}</label>
      <div className="flex items-center gap-1 w-36">
        {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
        <Input type="number" value={inputs[field]} onChange={e => set(field, e.target.value)} className="h-8 text-sm" />
        {suffix && <span className="text-slate-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );

  const MetricCard = ({ label, value, sub, color = 'text-slate-900', bg = 'bg-white' }) => (
    <Card className={`${bg} border`}>
      <CardContent className="pt-4">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <BarChart2 className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Admin Profit Calculator</h1>
        </div>
        <p className="text-slate-500 text-sm mb-6">Real-time P&L breakdown across all revenue streams</p>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Gross Revenue (Mo.)" value={`$${gross_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="text-blue-600" />
          <MetricCard label="Total Expenses (Mo.)" value={`$${total_expenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="text-red-600" />
          <MetricCard label="Net Profit (Mo.)" value={`$${net_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color={net_profit >= 0 ? 'text-green-600' : 'text-red-600'} />
          <MetricCard label="Profit Margin" value={`${profit_margin}%`} color={parseFloat(profit_margin) >= 20 ? 'text-green-600' : 'text-yellow-600'} />
        </div>

        {/* Survey Client Value Box */}
        <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              📋 DIY Survey Plan — Client Value Proposition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl border border-purple-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Client Pays (Annual)</p>
                <p className="text-3xl font-black text-purple-700">${SURVEY_SUBSCRIPTION_ANNUAL.toLocaleString()}</p>
                <p className="text-xs text-slate-400">3,000 responses × $0.95 = ${(MIN_RESPONSES * SURVEY_COST_PER_RESPONSE).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Total Value Delivered</p>
                <p className="text-3xl font-black text-blue-700">${client_total_value.toLocaleString()}</p>
                <p className="text-xs text-slate-400">${client_data_value.toLocaleString()} data + ${AD_VALUE_BONUS.toLocaleString()} AI ads value</p>
              </div>
              <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Client Net Gain</p>
                <p className="text-3xl font-black text-green-700">${client_net_gain.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Value received minus subscription cost</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <p className="font-bold text-amber-800 mb-2">📣 Our Guarantee to Clients</p>
                <ul className="text-sm text-amber-900 space-y-1">
                  <li>✓ 3,000 verified survey responses at $0.95/response</li>
                  <li>✓ <strong>$12,000 in AI advertising value</strong> included free</li>
                  <li>✓ We keep working until they <strong>double their investment</strong></li>
                  <li>✓ Auto-renewal annual subscription for continuous data</li>
                  <li>✓ Anti-fraud trust score on every response</li>
                </ul>
              </div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <p className="font-bold text-green-800 mb-2">💰 Our Profit Per DIY Client</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Client pays</span><span className="font-bold">${SURVEY_SUBSCRIPTION_ANNUAL.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">We pay respondents (~50%)</span><span className="font-bold text-red-600">-${cost_per_diy_client.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="text-slate-700 font-semibold">Gross profit</span><span className="font-black text-green-700">${gross_per_diy.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
                  <p className="text-xs text-slate-400 mt-1">$1,460 net profit per client after respondent payouts</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base text-purple-700">📋 Survey Revenue Inputs</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InputRow label="DIY Survey subscriptions (annual)" field="diy_surveys_sold" />
                <InputRow label="Full-Service projects ($5K ea.)" field="full_service_projects" />
                <InputRow label="Enterprise projects ($10K ea.)" field="enterprise_projects" />
                <InputRow label="BitLabs responses (no min req.)" field="bitlabs_responses" />
                <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-purple-700">
                  DIY revenue: {inputs.diy_surveys_sold} × ${SURVEY_SUBSCRIPTION_ANNUAL.toLocaleString()} = <strong>${diy_revenue.toLocaleString()}</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-yellow-700">📊 Advertiser Revenue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InputRow label="Daily plans active ($8/day × 30)" field="daily_ad_plans" />
                <InputRow label="Monthly plans ($240/mo)" field="monthly_ad_plans" />
                <InputRow label="Annual plans ($2,000/yr)" field="annual_ad_plans" />
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                  Ad Revenue: <strong>${ad_total_revenue.toLocaleString()}/mo</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-blue-700">🎮 Developer & Other Revenue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InputRow label="Developer installs (CPI $6)" field="developer_installs" />
                <InputRow label="IAP revenue (50% split)" field="iap_revenue" prefix="$" />
                <InputRow label="Active referral earners" field="active_referrals" />
                <InputRow label="Avg daily earn per referral" field="avg_referral_daily_earn" prefix="$" />
                <InputRow label="Monthly store GMV" field="store_gmv" prefix="$" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-red-700">💸 Expense Inputs</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InputRow label="Server / infrastructure" field="server_costs" prefix="$" />
                <InputRow label="Payment processing %" field="payment_processing_pct" suffix="%" />
                <InputRow label="Support staff" field="support_staff" prefix="$" />
                <InputRow label="Affiliate payouts" field="affiliate_payouts" prefix="$" />
                <InputRow label="BitLabs respondent cost" field="bitlabs_payout_cost" prefix="$" />
                <InputRow label="Other expenses" field="other_expenses" prefix="$" />
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'DIY Survey Subscriptions', value: diy_revenue, color: 'bg-purple-500' },
                  { label: 'Full-Service Surveys', value: full_service_revenue, color: 'bg-purple-300' },
                  { label: 'Enterprise Surveys', value: enterprise_revenue, color: 'bg-purple-200' },
                  { label: 'BitLabs Revenue', value: bitlabs_revenue, color: 'bg-indigo-400' },
                  { label: 'Ad Plans', value: ad_total_revenue, color: 'bg-yellow-400' },
                  { label: 'Developer (CPI + IAP)', value: dev_total_revenue, color: 'bg-blue-400' },
                  { label: 'Referral Platform Cut', value: referral_platform_revenue, color: 'bg-green-400' },
                  { label: 'Store Fees', value: store_revenue, color: 'bg-orange-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold">${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: gross_revenue > 0 ? `${(item.value / gross_revenue) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Total Revenue</span>
                  <span className="text-blue-600">${gross_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Expense Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Survey Respondent Payouts', value: survey_respondent_cost },
                  { label: 'BitLabs Payout Cost', value: bitlabs_payout },
                  { label: 'Payment Processing Fees', value: payment_fees },
                  { label: 'Affiliate Payouts', value: affiliate_payouts },
                  { label: 'Support Staff', value: inputs.support_staff },
                  { label: 'Server Costs', value: inputs.server_costs },
                  { label: 'Other Expenses', value: inputs.other_expenses },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm py-1 border-b border-slate-50">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold text-red-600">${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span>Total Expenses</span>
                  <span className="text-red-600">${total_expenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-2 ${net_profit >= 0 ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-slate-500 mb-1">Monthly Net Profit</p>
                <p className={`text-5xl font-black mb-2 ${net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ${net_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <Badge className={net_profit >= 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
                  {profit_margin}% Margin
                </Badge>
                <p className="text-sm text-slate-500 mt-3">
                  Annual projection: <span className="font-bold">${(net_profit * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </p>
              </CardContent>
            </Card>

            {/* Subscription Note */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="font-semibold text-blue-800 text-sm mb-2">🔄 Subscription Auto-Renewal Policy</p>
                <ul className="text-xs text-blue-900 space-y-1">
                  <li>✓ All DIY Survey plans: <strong>annual auto-renewal</strong> (continuous subscription)</li>
                  <li>✓ Business tiers (Full-Service / Enterprise): <strong>annual auto-renewal</strong></li>
                  <li>✓ PPC ad plans: auto-renew daily/monthly/annually per selected plan</li>
                  <li>✓ Cancel anytime before renewal date to avoid next charge</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}