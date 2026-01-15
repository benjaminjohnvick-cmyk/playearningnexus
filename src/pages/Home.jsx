import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, DollarSign, Gamepad2, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SocialLoginButtons from "../components/auth/SocialLoginButtons";

export default function Home() {
  const features = [
    {
      icon: Gamepad2,
      title: "60 Games Per Year",
      description: "New featured game every 6 days added to your library",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: DollarSign,
      title: "Earn While Playing",
      description: "Complete surveys to unlock games and earn rewards",
      color: "from-emerald-500 to-emerald-600"
    },
    {
      icon: Users,
      title: "Curated Community",
      description: "Join groups of 100,000 engaged players",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: TrendingUp,
      title: "For Developers",
      description: "Monetize your games with guaranteed user engagement",
      color: "from-amber-500 to-amber-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5" />
        <div className="max-w-7xl mx-auto px-6 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Play Premium Games.
              <br />Earn Real Rewards.
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              A revolutionary platform connecting gamers with top mobile games through 
              survey-based monetization. Play featured games, complete surveys, and build your library.
            </p>
            
            {/* Social Login Buttons */}
            <div className="max-w-md mx-auto mb-8">
              <SocialLoginButtons />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={createPageUrl('UserDashboard')}>
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg px-8 h-14">
                  Start Playing
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('BusinessDashboard')}>
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2">
                  For Developers
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-lg text-gray-600">Simple, transparent, and rewarding for everyone</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all h-full">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center text-white">
            <div>
              <div className="text-5xl font-bold mb-2">60+</div>
              <div className="text-blue-100">Games Per Year</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">100K</div>
              <div className="text-blue-100">User Groups</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">50/50</div>
              <div className="text-blue-100">Revenue Share</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to Start Your Gaming Journey?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of players earning rewards while enjoying premium mobile games
          </p>
          <Link to={createPageUrl('UserDashboard')}>
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 h-14">
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}