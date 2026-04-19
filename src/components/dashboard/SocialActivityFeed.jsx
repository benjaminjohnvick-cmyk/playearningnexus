import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, MessageCircle, Trophy, TrendingUp, Star, Gamepad2, Users, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const MOCK_FEED = [
  {
    id: 1,
    type: 'winner',
    user: 'Alex M.',
    avatar: '🏆',
    action: 'just won $47.50 in the Weekly Tournament!',
    time: '2m ago',
    likes: 24,
    comments: [],
    color: 'from-yellow-50 to-orange-50',
    border: 'border-yellow-200',
  },
  {
    id: 2,
    type: 'milestone',
    user: 'GamerGain',
    avatar: '🎉',
    action: '10,000 users have now earned $3+ today — community milestone reached!',
    time: '15m ago',
    likes: 312,
    comments: [],
    color: 'from-green-50 to-emerald-50',
    border: 'border-green-200',
  },
  {
    id: 3,
    type: 'trending',
    user: 'Trending',
    avatar: '🔥',
    action: '"Pixel Raiders" is trending — 1,200 installs in the last hour!',
    time: '30m ago',
    likes: 88,
    comments: [],
    color: 'from-red-50 to-pink-50',
    border: 'border-red-200',
  },
  {
    id: 4,
    type: 'winner',
    user: 'Jordan K.',
    avatar: '💰',
    action: 'referred 5 friends and earned a $25 bonus!',
    time: '1h ago',
    likes: 51,
    comments: [],
    color: 'from-purple-50 to-blue-50',
    border: 'border-purple-200',
  },
  {
    id: 5,
    type: 'milestone',
    user: 'Community',
    avatar: '🌟',
    action: 'Total platform earnings crossed $2,000,000 this week!',
    time: '2h ago',
    likes: 504,
    comments: [],
    color: 'from-blue-50 to-cyan-50',
    border: 'border-blue-200',
  },
  {
    id: 6,
    type: 'trending',
    user: 'Trending',
    avatar: '📈',
    action: '"Space Blasters" just hit a 4.9 star rating with 800+ reviews!',
    time: '3h ago',
    likes: 67,
    comments: [],
    color: 'from-indigo-50 to-purple-50',
    border: 'border-indigo-200',
  },
];

const typeIcon = { winner: <Trophy className="w-3 h-3" />, milestone: <Star className="w-3 h-3" />, trending: <TrendingUp className="w-3 h-3" /> };
const typeBadge = { winner: 'bg-yellow-100 text-yellow-700', milestone: 'bg-green-100 text-green-700', trending: 'bg-red-100 text-red-700' };

export default function SocialActivityFeed() {
  const [feed, setFeed] = useState(MOCK_FEED);
  const [likedIds, setLikedIds] = useState(new Set());
  const [openComment, setOpenComment] = useState(null);
  const [commentText, setCommentText] = useState('');

  const toggleLike = (id) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setFeed(f => f.map(item => item.id === id ? { ...item, likes: item.likes - 1 } : item));
      } else {
        next.add(id);
        setFeed(f => f.map(item => item.id === id ? { ...item, likes: item.likes + 1 } : item));
      }
      return next;
    });
  };

  const submitComment = (id) => {
    if (!commentText.trim()) return;
    setFeed(f => f.map(item =>
      item.id === id
        ? { ...item, comments: [...item.comments, { text: commentText.trim(), time: 'just now', user: 'You' }] }
        : item
    ));
    setCommentText('');
    setOpenComment(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-red-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Community Activity</h3>
        <Badge className="bg-red-100 text-red-700 text-xs ml-auto">Live</Badge>
      </div>

      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {feed.map(item => (
          <div key={item.id} className={`bg-gradient-to-r ${item.color} border ${item.border} rounded-xl p-3`}>
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none mt-0.5">{item.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-900 text-xs">{item.user}</span>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${typeBadge[item.type]}`}>
                    {typeIcon[item.type]} {item.type}
                  </span>
                </div>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{item.action}</p>
                <p className="text-xs text-gray-400 mt-1">{item.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/50">
              <button
                onClick={() => toggleLike(item.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${likedIds.has(item.id) ? 'text-red-500 font-semibold' : 'text-gray-500 hover:text-red-400'}`}
              >
                <Heart className={`w-3.5 h-3.5 ${likedIds.has(item.id) ? 'fill-red-500' : ''}`} />
                {item.likes}
              </button>
              <button
                onClick={() => setOpenComment(openComment === item.id ? null : item.id)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {item.comments.length > 0 ? item.comments.length : 'Comment'}
              </button>
            </div>

            {item.comments.length > 0 && (
              <div className="mt-2 space-y-1">
                {item.comments.map((c, i) => (
                  <div key={i} className="bg-white/60 rounded-lg px-2 py-1 text-xs text-gray-700">
                    <span className="font-medium">{c.user}:</span> {c.text}
                  </div>
                ))}
              </div>
            )}

            {openComment === item.id && (
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment(item.id)}
                  autoFocus
                />
                <button onClick={() => submitComment(item.id)} className="text-red-500 hover:text-red-700">
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpenComment(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}