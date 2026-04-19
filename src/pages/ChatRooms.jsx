import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Hash, Lock, Plus, Search, Users, MessageCircle, X, ArrowLeft, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const PUBLIC_ROOMS = [
  { id: 'general', name: 'General', icon: '💬', description: 'General chat for everyone', members: 1284, color: 'bg-blue-100 text-blue-700' },
  { id: 'game-strategies', name: 'Game Strategies', icon: '🎮', description: 'Tips, tricks & game guides', members: 847, color: 'bg-green-100 text-green-700' },
  { id: 'tournaments', name: 'Tournaments', icon: '🏆', description: 'Coordinate tournament teams', members: 523, color: 'bg-yellow-100 text-yellow-700' },
  { id: 'referral-tips', name: 'Referral Tips', icon: '💰', description: 'Share referral strategies', members: 392, color: 'bg-purple-100 text-purple-700' },
  { id: 'ppc-crew', name: 'PPC Crew', icon: '📊', description: 'PPC ads & earnings talk', members: 215, color: 'bg-red-100 text-red-700' },
  { id: 'marketplace', name: 'Marketplace', icon: '🛍️', description: 'Buy, sell & trade tips', members: 178, color: 'bg-orange-100 text-orange-700' },
];

const SEED_MESSAGES = {
  general: [
    { id: 1, user: 'Alex M.', avatar: '😎', text: 'Hey everyone! Just hit $50 in earnings this week 🎉', time: '10:32 AM', isOwn: false },
    { id: 2, user: 'Jordan K.', avatar: '🦊', text: 'Nice! I\'m at $38, surveys have been really good today', time: '10:34 AM', isOwn: false },
    { id: 3, user: 'Sam R.', avatar: '🎯', text: 'Anyone tried the new Pixel Raiders game? Worth installing?', time: '10:41 AM', isOwn: false },
  ],
  'game-strategies': [
    { id: 1, user: 'ProGamer99', avatar: '🎮', text: 'For Space Blasters, always focus on the power-ups in the first 30 seconds', time: '9:15 AM', isOwn: false },
    { id: 2, user: 'TechWizard', avatar: '🧙', text: 'I hit level 50 by stacking the daily bonus + weekend multiplier', time: '9:22 AM', isOwn: false },
  ],
  tournaments: [
    { id: 1, user: 'TourneyBot', avatar: '🤖', text: '⚠️ Tournament starting in 2 hours! Register now at /Tournaments', time: '11:00 AM', isOwn: false },
    { id: 2, user: 'ChampionX', avatar: '🏆', text: 'LFG for the 4-player team bracket, I have 2 spots open', time: '11:05 AM', isOwn: false },
  ],
  'referral-tips': [
    { id: 1, user: 'ReferralKing', avatar: '👑', text: 'Pro tip: Share your link right after someone wins a tournament — conversion goes up 3x', time: '8:00 AM', isOwn: false },
    { id: 2, user: 'EarnMore', avatar: '💸', text: 'TikTok has been my best channel — 12 signups last week from one video', time: '8:15 AM', isOwn: false },
  ],
};

function ChatMessage({ msg }) {
  return (
    <div className={`flex gap-2 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">{msg.avatar}</div>
      <div className={`max-w-[70%] ${msg.isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!msg.isOwn && <span className="text-xs text-gray-400 mb-0.5 ml-1">{msg.user}</span>}
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.isOwn ? 'bg-red-600 text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'}`}>
          {msg.text}
        </div>
        <span className="text-xs text-gray-400 mt-0.5 mx-1">{msg.time}</span>
      </div>
    </div>
  );
}

function DirectMessageModal({ user, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const MOCK_USERS = [
    { id: 'u1', name: 'Alex M.', avatar: '😎', status: 'online' },
    { id: 'u2', name: 'Jordan K.', avatar: '🦊', status: 'online' },
    { id: 'u3', name: 'Sam R.', avatar: '🎯', status: 'away' },
    { id: 'u4', name: 'ProGamer99', avatar: '🎮', status: 'offline' },
    { id: 'u5', name: 'ChampionX', avatar: '🏆', status: 'online' },
  ];
  const filtered = MOCK_USERS.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const statusColor = { online: 'bg-green-400', away: 'bg-yellow-400', offline: 'bg-gray-300' };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">New Direct Message</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {!selected ? (
          <div className="p-4">
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="mb-3" />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filtered.map(u => (
                <button key={u.id} onClick={() => setSelected(u)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <div className="relative">
                    <span className="text-xl">{u.avatar}</span>
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${statusColor[u.status]}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : sent ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-900">Message sent to {selected.name}!</p>
            <Button onClick={onClose} className="mt-4 bg-red-600 hover:bg-red-700">Done</Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
              <span className="text-xl">{selected.avatar}</span>
              <span className="font-medium text-sm">{selected.name}</span>
              <button onClick={() => setSelected(null)} className="ml-auto text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></button>
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 h-28"
              placeholder={`Message ${selected.name}...`}
              value={msg}
              onChange={e => setMsg(e.target.value)}
            />
            <Button onClick={() => msg.trim() && setSent(true)} className="w-full mt-2 bg-red-600 hover:bg-red-700">
              <Send className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatRooms() {
  const [user, setUser] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showDM, setShowDM] = useState(false);
  const [searchRoom, setSearchRoom] = useState('');
  const [joinedRooms, setJoinedRooms] = useState(new Set(['general']));
  const bottomRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  useEffect(() => {
    if (activeRoom) {
      setMessages(SEED_MESSAGES[activeRoom.id] || []);
    }
  }, [activeRoom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !user) return;
    const newMsg = {
      id: Date.now(),
      user: user.full_name || 'You',
      avatar: '🙂',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
  };

  const joinRoom = (room) => {
    setJoinedRooms(prev => new Set([...prev, room.id]));
    setActiveRoom(room);
  };

  const filtered = PUBLIC_ROOMS.filter(r => r.name.toLowerCase().includes(searchRoom.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row" style={{ height: '100vh' }}>
      {/* Sidebar */}
      <div className={`${activeRoom ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 bg-white border-r border-gray-200`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-red-500" /> Chat
            </h1>
            <Button size="sm" onClick={() => setShowDM(true)} className="bg-red-600 hover:bg-red-700 h-8 px-3 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> DM
            </Button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input placeholder="Search rooms..." className="pl-8 h-8 text-sm" value={searchRoom} onChange={e => setSearchRoom(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wide">Public Rooms</p>
          {filtered.map(room => (
            <button
              key={room.id}
              onClick={() => joinRoom(room)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${activeRoom?.id === room.id ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'}`}
            >
              <span className="text-xl">{room.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 truncate">{room.name}</span>
                  {joinedRooms.has(room.id) && <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 truncate">{room.description}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-0.5">
                <Users className="w-3 h-3" />{room.members > 999 ? `${(room.members/1000).toFixed(1)}k` : room.members}
              </span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Wifi className="w-3.5 h-3.5 text-green-500" />
            <span>{user?.full_name || 'Loading...'}</span>
            <span className="ml-auto text-green-500 font-medium">● Online</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      {activeRoom ? (
        <div className="flex-1 flex flex-col">
          {/* Room Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setActiveRoom(null)} className="md:hidden text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xl">{activeRoom.icon}</span>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">{activeRoom.name}</h2>
              <p className="text-xs text-gray-400">{activeRoom.members.toLocaleString()} members • {activeRoom.description}</p>
            </div>
            <Badge className={`ml-auto text-xs ${activeRoom.color}`}>
              <Hash className="w-3 h-3 mr-1" /> public
            </Badge>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            <div className="text-center">
              <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">Welcome to #{activeRoom.name}</span>
            </div>
            {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <Input
                placeholder={`Message #${activeRoom.name}...`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                className="flex-1"
              />
              <Button onClick={sendMessage} className="bg-red-600 hover:bg-red-700 px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-500">Select a room to start chatting</h3>
            <p className="text-sm text-gray-400 mt-1">Join public rooms or send a direct message</p>
            <Button onClick={() => setShowDM(true)} className="mt-4 bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" /> New Direct Message
            </Button>
          </div>
        </div>
      )}

      {showDM && <DirectMessageModal user={user} onClose={() => setShowDM(false)} />}
    </div>
  );
}