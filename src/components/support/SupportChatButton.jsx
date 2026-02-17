import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import AISupportChatbot from './AISupportChatbot';

export default function SupportChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        // User not logged in
      }
    };
    fetchUser();
  }, []);

  if (!user) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 z-40 animate-pulse"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {isOpen && <AISupportChatbot user={user} isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}