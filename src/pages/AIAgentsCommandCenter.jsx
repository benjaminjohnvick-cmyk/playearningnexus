import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Bot, Send, Zap, Shield, TrendingUp, Users, DollarSign, Megaphone, BarChart2, Trophy, ShoppingCart, Star, Brain, Activity, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import MessageBubble from '@/components/agents/AgentMessageBubble';
import { toast } from 'sonner';

const AGENTS = [
  {
    key: 'platform_operations_superagent',
    label: 'Platform Ops Super Agent',
    emoji: '🤖',
    type: 'super',
    icon: Shield,
    color: 'from-red-600 to-rose-700',
    bg: 'bg-red-50 border-red-200',
    description: 'Master orchestrator — fraud, payouts, surveys, ads, platform health',
    actions: ['Run Daily Health Check', 'Fraud Sweep', 'Reconcile Financials', 'Check Pending Payouts'],
  },
  {
    key: 'growth_superagent',
    label: 'Growth Super Agent',
    emoji: '🚀',
    type: 'super',
    icon: TrendingUp,
    color: 'from-purple-600 to-indigo-700',
    bg: 'bg-purple-50 border-purple-200',
    description: 'Growth orchestrator — acquisition, referrals, retention, monetization',
    actions: ['Run Growth Analysis', 'Launch Retention Campaign', 'Optimize Referral Program', 'Weekly Growth Report'],
  },
  {
    key: 'fraud_detection',
    label: 'Fraud Detection AI',
    emoji: '🛡️',
    type: 'specialist',
    icon: Shield,
    color: 'from-red-500 to-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    description: 'Monitors fraud patterns, self-learns from admin reviews',
    actions: ['Scan All Users', 'Check Referral Fraud', 'Review Flagged Responses'],
  },
  {
    key: 'churn_predictor',
    label: 'Churn Predictor AI',
    emoji: '📉',
    type: 'specialist',
    icon: Activity,
    color: 'from-amber-500 to-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    description: 'Predicts churn risk, runs personalized retention campaigns',
    actions: ['Identify At-Risk Users', 'Launch Win-Back Campaign', 'Award Retention Bonuses'],
  },
  {
    key: 'campaign_optimizer',
    label: 'Campaign Optimizer AI',
    emoji: '📊',
    type: 'specialist',
    icon: Megaphone,
    color: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-50 border-blue-200',
    description: 'Optimizes campaigns, reallocates budgets, generates copy',
    actions: ['Analyze All Campaigns', 'Pause Underperformers', 'Generate New Ad Copy'],
  },
  {
    key: 'monetization_optimizer',
    label: 'Monetization Optimizer',
    emoji: '💰',
    type: 'specialist',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 border-green-200',
    description: 'Dynamic pricing, personalized offers, revenue distribution',
    actions: ['Optimize Pricing', 'Create Personalized Offers', 'Process Developer Payouts'],
  },
  {
    key: 'tournament_ai_manager',
    label: 'Tournament AI Manager',
    emoji: '🏆',
    type: 'specialist',
    icon: Trophy,
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-50 border-yellow-200',
    description: 'Matchmaking, brackets, prizes, post-tournament analysis',
    actions: ['Generate Brackets', 'Distribute Prizes', 'Analyze Tournament Results'],
  },
  {
    key: 'crm_automation_engine',
    label: 'CRM Automation Engine',
    emoji: '📬',
    type: 'specialist',
    icon: Users,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 border-violet-200',
    description: 'Full user & developer lifecycle — onboarding, nurturing, re-engagement',
    actions: ['Process New User Onboarding', 'Send Re-engagement Emails', 'Trigger Payout Alerts'],
  },
  {
    key: 'ad_operations_agent',
    label: 'Ad Operations AI',
    emoji: '📢',
    type: 'specialist',
    icon: BarChart2,
    color: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50 border-pink-200',
    description: 'Ad review, bidding, fatigue detection, creative rotation',
    actions: ['Review Pending Ads', 'Check Ad Fatigue', 'Optimize Bids'],
  },
  {
    key: 'payout_operations_agent',
    label: 'Payout Operations AI',
    emoji: '💸',
    type: 'specialist',
    icon: DollarSign,
    color: 'from-teal-500 to-green-600',
    bg: 'bg-teal-50 border-teal-200',
    description: 'Fraud-screened payout processing, disputes, reconciliation',
    actions: ['Process Pending Withdrawals', 'Run Reconciliation', 'Review Payout Disputes'],
  },
  {
    key: 'referral_growth_agent',
    label: 'Referral Growth AI',
    emoji: '👥',
    type: 'specialist',
    icon: Users,
    color: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-50 border-indigo-200',
    description: 'Conversion tracking, jackpot awards, email campaigns, squads',
    actions: ['Award Jackpot Entries', 'Send Referral Campaign', 'Process Commissions'],
  },
  {
    key: 'survey_operations_agent',
    label: 'Survey Operations AI',
    emoji: '📋',
    type: 'specialist',
    icon: CheckCircle,
    color: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-50 border-cyan-200',
    description: 'Quality control, fraud detection, auto-distribution, disputes',
    actions: ['Quality Scan All Surveys', 'Detect Response Fraud', 'Resolve Pending Disputes'],
  },
  {
    key: 'developer_success_agent',
    label: 'Developer Success AI',
    emoji: '🛠️',
    type: 'specialist',
    icon: Star,
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50 border-orange-200',
    description: 'Onboarding, game coaching, revenue optimization, disputes',
    actions: ['Review Pending Onboarding', 'Coach Underperforming Games', 'Process Developer Disputes'],
  },
  {
    key: 'content_and_social_agent',
    label: 'Content & Social AI',
    emoji: '🎨',
    type: 'specialist',
    icon: Megaphone,
    color: 'from-fuchsia-500 to-pink-600',
    bg: 'bg-fuchsia-50 border-fuchsia-200',
    description: 'Content generation, social distribution, YouTube, multilingual',
    actions: ['Generate Weekly Content', 'Schedule Social Posts', 'Embed YouTube Videos'],
  },
  {
    key: 'market_analyzer',
    label: 'Market Analyzer AI',
    emoji: '📈',
    type: 'specialist',
    icon: BarChart2,
    color: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-50 border-slate-200',
    description: 'Market trends, competitive intelligence, developer benchmarks',
    actions: ['Generate Market Report', 'Analyze Top Games', 'Competitive Intelligence Scan'],
  },
  {
    key: 'revenue_forecaster',
    label: 'Revenue Forecaster AI',
    emoji: '🔮',
    type: 'specialist',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 border-emerald-200',
    description: '30 and 90-day revenue forecasts, payout scheduling, risk alerts',
    actions: ['30-Day Forecast', '90-Day Forecast', 'Schedule Optimal Payouts'],
  },
  {
    key: 'support_bot',
    label: 'Support Bot AI',
    emoji: '💬',
    type: 'specialist',
    icon: MessageSquare,
    color: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-50 border-sky-200',
    description: 'Frontline user support, ticket triage, self-learning resolution',
    actions: ['Review Open Tickets', 'Auto-Resolve Common Issues', 'Escalation Report'],
  },
];

function AgentChatPanel({ agent }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setInput('');
  }, [agent.key]);

  const startConversation = async (initialMsg) => {
    setStarting(true);
    try {
      const conv = await base44.agents.createConversation({ agent_name: agent.key, metadata: { title: `${agent.label} Session` } });
      setConversation(conv);
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages([...data.messages]);
      });
      conv._unsubscribe = unsubscribe;
      const msg = initialMsg || `Hello! Please introduce yourself and tell me what you can do.`;
      await base44.agents.addMessage(conv, { role: 'user', content: msg });
      setInput('');
    } catch (e) {
      toast.error('Failed to start conversation: ' + e.message);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    if (!conversation) { startConversation(input); return; }
    setSending(true);
    const msg = input;
    setInput('');
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } catch (e) {
      toast.error('Send failed: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleAction = (action) => {
    if (!conversation) { startConversation(action); }
    else { setInput(action); }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Quick Actions */}
      <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2">
        {agent.actions.map(a => (
          <Button key={a} size="sm" variant="outline" className="text-xs h-7 border-gray-300 hover:bg-white"
            onClick={() => handleAction(a)} disabled={starting || sending}>
            <Zap className="w-3 h-3 mr-1" />{a}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 && !starting && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
              {agent.emoji}
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{agent.label}</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-4">{agent.description}</p>
            <Button onClick={() => startConversation()} disabled={starting}
              className={`bg-gradient-to-r ${agent.color} text-white gap-2`} size="sm">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Start Session
            </Button>
          </div>
        )}
        {starting && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-400 text-sm">Starting session…</span>
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={`Message ${agent.label}…`}
          className="flex-1 text-sm"
          disabled={starting}
        />
        <Button onClick={sendMessage} disabled={sending || starting || !input.trim()}
          className={`bg-gradient-to-r ${agent.color} text-white flex-shrink-0`} size="sm">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function AIAgentsCommandCenter() {
  const [user, setUser] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [activeTab, setActiveTab] = useState('command');

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.replace('/'); return; }
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: perfLogs = [] } = useQuery({
    queryKey: ['agent-perf-logs'],
    queryFn: () => base44.entities.AgentPerformanceLog.list('-created_date', 50),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: learningMemory = [] } = useQuery({
    queryKey: ['agent-learning'],
    queryFn: () => base44.entities.AgentLearningMemory.list('-created_date', 20),
    enabled: !!user,
  });

  const superAgents = AGENTS.filter(a => a.type === 'super');
  const specialists = AGENTS.filter(a => a.type === 'specialist');

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {AGENTS.length} AI Agents Online
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Agents Command Center</h1>
          <p className="text-gray-400 text-sm">Platform automation orchestration — 2 Super Agents + {specialists.length} Specialists</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/10 border border-white/20 p-1 mx-auto flex w-fit">
            <TabsTrigger value="command" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              🤖 Command Center
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              📊 Performance Logs
            </TabsTrigger>
            <TabsTrigger value="learning" className="text-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 text-sm">
              🧠 Learning Memory
            </TabsTrigger>
          </TabsList>

          {/* COMMAND CENTER */}
          <TabsContent value="command" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Agent selector */}
              <div className="space-y-3">
                {/* Super Agents */}
                <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider px-1">⚡ Super Agents</p>
                {superAgents.map(a => (
                  <button key={a.key} onClick={() => setSelectedAgent(a)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedAgent.key === a.key
                      ? 'bg-white/15 border-white/40 shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{a.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{a.label}</p>
                        <p className="text-gray-400 text-xs truncate">{a.description.slice(0, 50)}…</p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Specialists */}
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider px-1 pt-2">🔬 Specialist Agents</p>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {specialists.map(a => (
                    <button key={a.key} onClick={() => setSelectedAgent(a)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${selectedAgent.key === a.key
                        ? 'bg-white/15 border-white/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{a.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{a.label}</p>
                          <p className="text-gray-500 text-xs truncate">{a.description.slice(0, 40)}…</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Panel */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                {/* Agent Header */}
                <div className={`bg-gradient-to-r ${selectedAgent.color} p-4 flex items-center gap-3`}>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    {selectedAgent.emoji}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedAgent.label}</p>
                    <p className="text-white/70 text-xs">{selectedAgent.description}</p>
                  </div>
                  <Badge className={`ml-auto text-xs ${selectedAgent.type === 'super' ? 'bg-yellow-400/20 text-yellow-200 border-yellow-400/40' : 'bg-white/20 text-white border-white/30'}`}>
                    {selectedAgent.type === 'super' ? '⚡ Super Agent' : '🔬 Specialist'}
                  </Badge>
                </div>
                <AgentChatPanel key={selectedAgent.key} agent={selectedAgent} />
              </div>
            </div>
          </TabsContent>

          {/* PERFORMANCE LOGS */}
          <TabsContent value="performance" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" /> Agent Performance Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perfLogs.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No performance logs yet — start agent sessions to generate logs.</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {perfLogs.map((log, i) => (
                      <div key={log.id || i} className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-medium">{log.agent_name}</span>
                            <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">{log.action_type}</Badge>
                            {log.confidence_score && (
                              <Badge className={`text-xs ${log.confidence_score > 70 ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                {log.confidence_score}% confidence
                              </Badge>
                            )}
                          </div>
                          {log.predicted_outcome && <p className="text-gray-400">Predicted: {log.predicted_outcome}</p>}
                          {log.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {log.tags.map((t, ti) => <span key={ti} className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <span className="text-gray-500 flex-shrink-0">{new Date(log.created_date).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LEARNING MEMORY */}
          <TabsContent value="learning" className="mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> Agent Learning Memory
                  <Badge className="ml-2 bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                    {learningMemory.filter(m => m.admin_approved).length} approved lessons
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {learningMemory.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No learning memories yet — agents will self-improve as they process more data.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {learningMemory.map((mem, i) => (
                      <div key={mem.id || i} className={`p-3 rounded-xl border text-xs ${mem.admin_approved ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-white font-medium">{mem.agent_name}</span>
                          <Badge className={`text-xs ${mem.admin_approved ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {mem.admin_approved ? '✓ Approved' : '⏳ Pending'}
                          </Badge>
                          {mem.learning_type && <Badge className="text-xs bg-purple-500/20 text-purple-300">{mem.learning_type}</Badge>}
                        </div>
                        {mem.lesson && <p className="text-gray-300">{mem.lesson}</p>}
                        {mem.context && <p className="text-gray-500 mt-0.5">{mem.context}</p>}
                        <p className="text-gray-600 mt-1">{new Date(mem.created_date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Agent Grid Overview */}
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3 font-semibold">All Active Agents</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {AGENTS.map(a => (
              <button key={a.key} onClick={() => { setSelectedAgent(a); setActiveTab('command'); }}
                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-center">
                <div className="text-2xl mb-1">{a.emoji}</div>
                <p className="text-white text-xs font-medium leading-tight">{a.label.replace(' AI', '').replace(' Agent', '').replace(' Super Agent', '')}</p>
                <div className="mt-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full mx-auto animate-pulse" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}