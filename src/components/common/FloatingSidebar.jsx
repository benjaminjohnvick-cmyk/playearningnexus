import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Menu, Home, User, Settings, Bell, MessageCircle, Trophy, Gamepad2, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function FloatingSidebar({ user }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Home', path: 'Home' },
    { icon: Gamepad2, label: 'Dashboard', path: 'UserDashboard' },
    { icon: DollarSign, label: 'Surveys', path: 'Surveys' },
    { icon: Trophy, label: 'Rewards', path: 'Gamification' },
    { icon: MessageCircle, label: 'Messages', path: 'Messages' },
    { icon: Bell, label: 'Notifications', path: 'Notifications' },
    { icon: User, label: 'Profile', path: 'Profile' },
    { icon: Settings, label: 'Settings', path: 'Settings' },
  ];

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-6 top-24 z-50 w-12 h-12 rounded-full shadow-lg bg-gradient-to-r from-red-600 to-red-700 hover:scale-110 transition-transform"
        size="icon"
      >
        <Menu className="w-6 h-6" />
      </Button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Menu</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              {user && (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{user.full_name}</p>
                    <p className="text-sm opacity-90">${(user.total_earnings || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    onClick={() => setIsOpen(false)}
                  >
                    <motion.div
                      whileHover={{ x: 8, backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-red-50 group"
                    >
                      <item.icon className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" />
                      <span className="font-medium text-gray-700 group-hover:text-red-600 transition-colors">
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                GameRewards © 2026
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}