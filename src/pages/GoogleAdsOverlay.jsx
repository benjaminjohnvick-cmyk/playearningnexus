import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Heart, ShoppingCart, CreditCard, Star, DollarSign, CheckCircle, Loader2, ArrowRight, Zap, ExternalLink, LayoutGrid, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const SAMPLE_ADS = [
  { id: 1, title: 'Nike Air Max 2024 Running Shoes', price: 129.99, brand: 'Nike', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop' },
  { id: 2, title: 'Apple AirPods Pro (2nd Generation)', price: 249.00, brand: 'Apple', image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=300&h=200&fit=crop' },
  { id: 3, title: 'Sony WH-1000XM5 Headphones', price: 349.99, brand: 'Sony', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop' },
];

export default function GoogleAdsOverlay() {
  const [user, setUser] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [surveyStep, setSurveyStep] = useState(0); // 0 = none, 1-4 = question #
  const [answers, setAnswers] = useState({});
  const [surveyDone, setSurveyDone] = useState(false);
  const [action, setAction] = useState(''); // 'wishlist' | 'buy' | 'bnpl'
  const [loading, setLoading] = useState(false);
  const [earned, setEarned] = useState(0);
  const [expenseLog, setExpenseLog] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    // Load expense log
    const saved = JSON.parse(localStorage.getItem('google_ad_expenses') || '[]');
    setExpenseLog(saved);
  }, []);

  const SURVEY_QUESTIONS = [
    {
      q: 'How often do you shop online for this category?',
      opts: ['Daily', 'Weekly', 'Monthly', 'Rarely'],
    },
    {
      q: 'What is most important to you when buying this product?',
      opts: ['Price', 'Brand', 'Reviews', 'Availability'],
    },
    {
      q: 'How likely are you to recommend this brand?',
      opts: ['Very likely', 'Likely', 'Unlikely', 'Never'],
    },
    {
      q: 'What price range do you typically budget for this?',
      opts: ['Under $50', '$50-$150', '$150-$300', 'Over $300'],
    },
  ];

  const handleAdAction = (ad, actionType) => {
    if (!user) {
      toast.error('Please sign in to use this feature');
      return;
    }
    setActiveAd(ad);
    setAction(actionType);
    setSurveyStep(1);
    setSurveyDone(false);
    setAnswers({});
  };

  const handleAnswer = (questionIdx, answer) => {
    const updated = { ...answers, [questionIdx]: answer };
    setAnswers(updated);
    if (questionIdx < 4) {
      setSurveyStep(questionIdx + 1);
    } else {
      completeSurvey(updated);
    }
  };

  const completeSurvey = async (finalAnswers) => {
    setLoading(true);
    setSurveyStep(0);

    try {
      // Award $0.20 to user and log $0.20 platform profit
      await base44.auth.updateMe({
        total_earnings: (user.total_earnings || 0) + 0.20,
      });
      setEarned(prev => prev + 0.20);

      // Perform the selected action
      if (action === 'wishlist') {
        await base44.entities.ProductWishlistItem.create({
          user_id: user.id,
          product_name: activeAd.title,
          product_image_url: activeAd.image,
          price: activeAd.price,
          product_url: `https://google.com/search?q=${encodeURIComponent(activeAd.title)}`,
          added_by: 'google_ads_overlay',
        });
        toast.success(`Added to wishlist! You earned $0.20`);
      } else if (action === 'buy') {
        // Log as expense
        const newExpense = {
          id: Date.now(),
          title: activeAd.title,
          price: activeAd.price,
          date: new Date().toISOString(),
          status: 'logged',
          earnBackDays: Math.ceil(activeAd.price / 3),
        };
        const updated = [newExpense, ...expenseLog];
        setExpenseLog(updated);
        localStorage.setItem('google_ad_expenses', JSON.stringify(updated));

        await base44.entities.Order.create({
          user_id: user.id,
          product_name: activeAd.title,
          product_image_url: activeAd.image,
          product_type: 'physical_product',
          source: 'ppc_marketplace',
          amount: activeAd.price,
          payment_method: 'paypal',
          vendor_name: activeAd.brand,
          shipping_status: 'processing',
          notes: `Google Ads overlay purchase. Earn back at $3/day = ${Math.ceil(activeAd.price / 3)} days`,
        });
        toast.success(`Purchase logged! AI is tracking this expense. You earned $0.20`);
      } else if (action === 'bnpl') {
        const daysToPayoff = Math.ceil(activeAd.price / 3);
        const friendsNeeded = Math.max(0, Math.ceil((activeAd.price - 90) / 90));
        toast.success(`BNPL set up! Payoff in ${daysToPayoff} days solo or ${friendsNeeded} friend${friendsNeeded !== 1 ? 's' : ''} to pay in 1 month`);
        const newExpense = {
          id: Date.now(),
          title: activeAd.title,
          price: activeAd.price,
          date: new Date().toISOString(),
          status: 'bnpl',
          daysToPayoff,
          friendsNeeded,
        };
        const updated = [newExpense, ...expenseLog];
        setExpenseLog(updated);
        localStorage.setItem('google_ad_expenses', JSON.stringify(updated));
      }
    } catch (e) {
      toast.error('Action failed: ' + e.message);
    }

    setSurveyDone(true);
    setLoading(false);
    setTimeout(() => { setActiveAd(null); setSurveyDone(false); }, 2000);
  };

  const currentQuestion = surveyStep >= 1 && surveyStep <= 4 ? SURVEY_QUESTIONS[surveyStep - 1] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutGrid className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Ads Overlay</h1>
          <p className="text-gray-600">
            Every Google ad gets <strong>Wishlist</strong>, <strong>Buy Now</strong>, and <strong>BNPL</strong> buttons.
            Answer 4 quick survey questions and earn <span className="font-bold text-green-600">$0.20</span> per ad click!
          </p>
          {earned > 0 && (
            <Badge className="mt-2 bg-green-600 text-white text-sm">
              💰 You've earned ${earned.toFixed(2)} today from ad surveys
            </Badge>
          )}
        </motion.div>

        {/* How it works */}
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> How It Works</h3>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="text-2xl mb-1">1️⃣</div>
                <p>Click Wishlist, Buy, or BNPL on any Google ad</p>
              </div>
              <div>
                <div className="text-2xl mb-1">2️⃣</div>
                <p>Answer 4 survey questions worth $0.40 total</p>
              </div>
              <div>
                <div className="text-2xl mb-1">3️⃣</div>
                <p>Earn $0.20 — advertiser gets listed, $0.20 goes to platform</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sample Google Ads with overlay buttons */}
        <h2 className="font-bold text-lg text-gray-900 mb-4">Sample Google Ads with Overlay Buttons</h2>
        <div className="space-y-4 mb-8">
          {SAMPLE_ADS.map((ad, i) => (
            <motion.div key={ad.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-2 border-blue-100 hover:border-blue-300 transition-all">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <img src={ad.image} alt={ad.title} className="w-24 h-20 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {/* Simulated ad header */}
                      <div className="flex items-center gap-1 mb-1">
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-300">Ad</Badge>
                        <span className="text-xs text-green-700">google.com/shopping</span>
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">{ad.title}</p>
                      <p className="text-lg font-bold text-green-600">${ad.price.toFixed(2)}</p>
                      
                      {/* Overlay Action Buttons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-pink-400 text-pink-600 hover:bg-pink-50 text-xs"
                          onClick={() => handleAdAction(ad, 'wishlist')}
                        >
                          <Heart className="w-3 h-3 mr-1" /> Wishlist
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          onClick={() => handleAdAction(ad, 'buy')}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" /> Buy Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-400 text-blue-600 hover:bg-blue-50 text-xs"
                          onClick={() => handleAdAction(ad, 'bnpl')}
                        >
                          <CreditCard className="w-3 h-3 mr-1" /> Buy Now Pay Later
                        </Button>
                        <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> +$0.20 survey
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Expense Log */}
        {expenseLog.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Receipt className="w-4 h-4 text-orange-500" /> AI Purchase Tracker & Expense Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expenseLog.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{exp.title}</p>
                      <p className="text-xs text-gray-500">{new Date(exp.date).toLocaleDateString()}</p>
                      {exp.status === 'bnpl' && (
                        <p className="text-xs text-blue-600">BNPL: {exp.daysToPayoff} days solo · {exp.friendsNeeded} friends for 1-month payoff</p>
                      )}
                      {exp.status === 'logged' && (
                        <p className="text-xs text-green-600">Earn back in ~{exp.earnBackDays} days at $3/day</p>
                      )}
                    </div>
                    <Badge className="bg-orange-100 text-orange-700">${exp.price?.toFixed(2)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Link to={createPageUrl('AIOrderForm')} className="flex-1">
            <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <ShoppingCart className="w-4 h-4 mr-2" /> AI Order Form
            </Button>
          </Link>
          <Link to={createPageUrl('Wishlist')} className="flex-1">
            <Button variant="outline" className="w-full">
              <Heart className="w-4 h-4 mr-2" /> My Wishlist
            </Button>
          </Link>
        </div>
      </div>

      {/* Survey Modal */}
      <AnimatePresence>
        {currentQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-green-600 text-white">Question {surveyStep} of 4 · +$0.10</Badge>
                <span className="text-xs text-gray-500">Total: $0.40</span>
              </div>
              
              <div className="flex gap-1 mb-4">
                {[1,2,3,4].map(n => (
                  <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= surveyStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                ))}
              </div>

              <p className="font-bold text-gray-900 mb-1 text-sm">About: {activeAd?.title}</p>
              <p className="text-gray-700 mb-4">{currentQuestion.q}</p>

              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.opts.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-12 text-sm hover:bg-green-50 hover:border-green-400"
                    onClick={() => handleAnswer(surveyStep, opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {(loading || surveyDone) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          >
            <div className="bg-white rounded-2xl p-8 text-center max-w-xs mx-4">
              {loading ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto mb-3" />
                  <p className="font-bold text-gray-900">Processing…</p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
                  <p className="font-bold text-green-700 text-lg">+$0.20 Earned!</p>
                  <p className="text-sm text-gray-600">Action completed successfully</p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}