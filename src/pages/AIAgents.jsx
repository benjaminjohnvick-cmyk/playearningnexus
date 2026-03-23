import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Zap, TrendingUp, Globe, Settings, TestTube, Store, DollarSign, Search, ShoppingBag } from "lucide-react";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";

export default function AIAgents() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const agents = [
    {
      name: 'fraud_detection',
      title: 'Fraud Detection AI',
      icon: Bot,
      description: 'Proactively monitors user activity for fraudulent patterns, bot behavior, and suspicious earning velocities',
      replaces: 'Fraud Prevention Tools',
      color: 'red',
      features: ['Pattern analysis', 'Bot detection', 'Risk scoring', 'Auto-flagging']
    },
    {
      name: 'churn_predictor',
      title: 'Churn Prediction AI',
      icon: TrendingUp,
      description: 'Predicts user churn risk and triggers personalized retention strategies to keep users engaged',
      replaces: 'Retention Platform',
      color: 'amber',
      features: ['Churn scoring', 'Retention triggers', 'Re-engagement', 'Offer creation']
    },
    {
      name: 'content_recommender',
      title: 'Content Recommender AI',
      icon: Zap,
      description: 'Generates personalized game, survey, and challenge recommendations based on user behavior and preferences',
      replaces: 'Recommendation Engine',
      color: 'purple',
      features: ['Personalization', 'Behavior analysis', 'Relevance scoring', 'Smart matching']
    },
    {
      name: 'sentiment_analyzer',
      title: 'Sentiment Analysis AI',
      icon: MessageSquare,
      description: 'Analyzes reviews, ratings, and feedback to understand user sentiment and identify trending issues',
      replaces: 'Survey Analytics',
      color: 'blue',
      features: ['Review analysis', 'Sentiment scoring', 'Trend detection', 'Actionable insights']
    },
    {
      name: 'support_bot',
      title: 'AI Support Agent',
      icon: MessageSquare,
      description: 'Handles common user queries instantly, creates tickets for complex issues, and provides 24/7 support',
      replaces: 'Customer Support',
      color: 'green',
      features: ['Auto-responses', 'Ticket creation', '24/7 availability', 'Learning system']
    },
    {
      name: 'revenue_forecaster',
      title: 'Revenue Forecasting AI',
      icon: TrendingUp,
      description: 'Predicts future revenue for developers using historical data, trends, and predictive analytics',
      replaces: 'Analytics Platform',
      color: 'indigo',
      features: ['Revenue predictions', 'Trend analysis', 'Confidence intervals', 'Growth forecasts']
    },
    {
      name: 'monetization_optimizer',
      title: 'Monetization Optimizer',
      icon: TrendingUp,
      description: 'Optimizes revenue through dynamic pricing, personalized offers, promotional content, and automated payouts',
      replaces: 'Monetization Platform',
      color: 'green',
      features: ['Dynamic pricing', 'Personalized offers', 'Ad generation', 'Auto payouts']
    },
    {
      name: 'gamification_manager',
      title: 'Gamification Manager',
      icon: TrendingUp,
      description: 'Manages streaks, achievements, leaderboards, and sends personalized game challenges and push notifications',
      replaces: 'Engagement Platform',
      color: 'purple',
      features: ['Streak tracking', 'Achievement unlocks', 'Leaderboard updates', 'Push notifications']
    },
    {
      name: 'crm_manager',
      title: 'CRM Manager',
      icon: TrendingUp,
      description: 'Manages business client relationships, tracks performance metrics, generates reports, and automates follow-ups',
      replaces: 'GoHighLevel',
      color: 'blue',
      features: ['Client tracking', 'Performance reports', 'Automated follow-ups', 'Revenue analysis']
    },
    {
      name: 'voice_generator',
      title: 'Voice Generator',
      icon: MessageSquare,
      description: 'Creates high-quality voice content for marketing, announcements, and communications',
      replaces: 'ElevenLabs',
      color: 'purple',
      features: ['Marketing audio', 'Announcements', 'Multi-language', 'Voice ads']
    },
    {
      name: 'marketing_automation',
      title: 'Marketing Automation',
      icon: Zap,
      description: 'Creates and distributes content across social media, forums, email, and SMS campaigns',
      replaces: 'NVIDIA DGX Spark',
      color: 'green',
      features: ['Social media posts', 'Email campaigns', 'Forum marketing', 'Ad copy']
    },
    {
      name: 'ab_test_optimizer',
      title: 'A/B Test Optimizer',
      icon: TestTube,
      description: 'Automatically manages A/B tests, optimizes variants, and determines winners with statistical significance',
      replaces: 'Testing Platform',
      color: 'teal',
      features: ['Test management', 'Auto-optimization', 'Winner detection', 'Statistical analysis']
    },
    {
      name: 'market_analyzer',
      title: 'Market Analysis AI',
      icon: TrendingUp,
      description: 'Analyzes market trends, game performance, and provides competitive intelligence for developers',
      replaces: 'Market Research',
      color: 'pink',
      features: ['Trend tracking', 'Competitive intel', 'Performance metrics', 'Market insights']
    },
    {
      name: 'compliance_monitor',
      title: 'Compliance Monitor AI',
      icon: Settings,
      description: 'Monitors platform activities for policy violations, regulatory compliance, and content moderation',
      replaces: 'Compliance Tools',
      color: 'red',
      features: ['Policy enforcement', 'Auto-moderation', 'Audit logging', 'Violation flagging']
    },
    {
      name: 'challenge_manager',
      title: 'Challenge Manager AI',
      icon: Zap,
      description: 'Creates personalized daily challenges and weekly events based on user activity and preferences',
      replaces: 'Engagement Tools',
      color: 'purple',
      features: ['Challenge creation', 'Difficulty balancing', 'Reward optimization', 'Event management']
    }
  ];

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
    pink: 'from-pink-500 to-pink-600',
    teal: 'from-teal-500 to-teal-600'
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">AI Agents</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Powerful AI agents that replace third-party integrations and automate platform operations
          </p>
        </div>

        {/* Game Store Banner */}
        <Link to={createPageUrl('InAppGameStore')} className="block mb-6">
          <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">Search for any product you want</p>
              <p className="text-purple-100 text-sm">Pay with surveys — browse the full game store and use your survey earnings to purchase</p>
            </div>
            <ShoppingBag className="w-8 h-8 text-white/70 flex-shrink-0" />
          </div>
        </Link>

        <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <Zap className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">100% AI-Powered Platform</h3>
              <p className="text-gray-700 mb-3">
                All platform operations are automated by custom AI agents. No expensive third-party services, no vendor lock-in, complete control over your business logic.
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge className="bg-green-100 text-green-700">Cost Effective</Badge>
                <Badge className="bg-blue-100 text-blue-700">Customizable</Badge>
                <Badge className="bg-purple-100 text-purple-700">Fully Integrated</Badge>
                <Badge className="bg-amber-100 text-amber-700">24/7 Automation</Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card key={agent.name} className="p-6 hover:shadow-xl transition-shadow border-0">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[agent.color]}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{agent.title}</h3>
                      <Badge variant="outline" className="text-xs">Replaces {agent.replaces}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{agent.description}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-gray-700">Key Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {agent.features.map((feature, idx) => (
                      <Badge key={idx} className="bg-gray-100 text-gray-700 text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                <a 
                  href={base44.agents.getWhatsAppConnectURL(agent.name)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button className={`w-full bg-gradient-to-r ${colorClasses[agent.color]}`}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Connect on WhatsApp
                  </Button>
                </a>
              </Card>
            );
          })}
        </div>

        <Card className="p-8 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <h3 className="text-2xl font-bold mb-4">Why AI Agents?</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-300" />
                <h4 className="font-bold text-blue-300">Cost Savings</h4>
              </div>
              <p className="text-sm text-gray-300">
                Save thousands per month on GoHighLevel ($297-$497/mo), ElevenLabs ($22-$330/mo), Twilio ($0.0079/SMS), and other services.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5 text-green-300" />
                <h4 className="font-bold text-green-300">Customization</h4>
              </div>
              <p className="text-sm text-gray-300">
                AI agents understand your business logic and adapt to your specific needs. No rigid third-party limitations.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-300" />
                <h4 className="font-bold text-purple-300">Scalability</h4>
              </div>
              <p className="text-sm text-gray-300">
                Agents scale automatically with your platform growth. No per-user pricing or API limits.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}