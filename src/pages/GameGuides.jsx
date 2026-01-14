import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ThumbsUp, ThumbsDown, Eye, Plus, Edit, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function GameGuidesPage() {
  const [user, setUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const queryClient = useQueryClient();

  const [guideData, setGuideData] = useState({
    game_id: '',
    title: '',
    content: '',
    guide_type: 'tutorial'
  });

  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  const { data: guides = [] } = useQuery({
    queryKey: ['gameGuides'],
    queryFn: () => base44.entities.GameGuide.filter({ status: 'approved' }, '-created_date')
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list()
  });

  const createGuideMutation = useMutation({
    mutationFn: (data) => base44.entities.GameGuide.create({
      ...data,
      author_user_id: user.id,
      status: 'pending'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameGuides'] });
      setShowCreateForm(false);
      setGuideData({ game_id: '', title: '', content: '', guide_type: 'tutorial' });
      toast.success('Guide submitted for review!');
    }
  });

  const voteGuideMutation = useMutation({
    mutationFn: ({ guideId, isUpvote }) => {
      const guide = guides.find(g => g.id === guideId);
      return base44.entities.GameGuide.update(guideId, {
        upvotes: isUpvote ? (guide.upvotes || 0) + 1 : guide.upvotes,
        downvotes: !isUpvote ? (guide.downvotes || 0) + 1 : guide.downvotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameGuides'] });
    }
  });

  const featuredGuides = guides.filter(g => g.is_featured);
  const allGuides = guides.filter(g => !g.is_featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent mb-2">
              Game Guides & Tutorials
            </h1>
            <p className="text-gray-600">Learn strategies and tips from the community</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-to-r from-red-600 to-red-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Guide
          </Button>
        </div>

        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={guideData.game_id} onValueChange={(v) => setGuideData({ ...guideData, game_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Guide Title"
                value={guideData.title}
                onChange={(e) => setGuideData({ ...guideData, title: e.target.value })}
              />

              <Select value={guideData.guide_type} onValueChange={(v) => setGuideData({ ...guideData, guide_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="tips">Tips & Tricks</SelectItem>
                  <SelectItem value="walkthrough">Walkthrough</SelectItem>
                  <SelectItem value="strategy">Strategy Guide</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Write your guide (Markdown supported)..."
                value={guideData.content}
                onChange={(e) => setGuideData({ ...guideData, content: e.target.value })}
                className="min-h-[300px] font-mono"
              />

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                <Button
                  onClick={() => createGuideMutation.mutate(guideData)}
                  disabled={!guideData.game_id || !guideData.title || !guideData.content}
                  className="bg-red-600"
                >
                  Submit Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedGuide ? (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{selectedGuide.title}</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <Badge>{selectedGuide.guide_type}</Badge>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {selectedGuide.views || 0} views
                    </span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setSelectedGuide(null)}>
                  Back to Guides
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none mb-6">
                <ReactMarkdown>{selectedGuide.content}</ReactMarkdown>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => voteGuideMutation.mutate({ guideId: selectedGuide.id, isUpvote: true })}
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  {selectedGuide.upvotes || 0}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => voteGuideMutation.mutate({ guideId: selectedGuide.id, isUpvote: false })}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  {selectedGuide.downvotes || 0}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {featuredGuides.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-600" />
                  Featured Guides
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {featuredGuides.map((guide) => {
                    const game = games.find(g => g.id === guide.game_id);
                    return (
                      <motion.div key={guide.id} whileHover={{ scale: 1.02 }}>
                        <Card className="cursor-pointer border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white" onClick={() => setSelectedGuide(guide)}>
                          <CardContent className="p-6">
                            <Badge className="mb-2 bg-yellow-600">{guide.guide_type}</Badge>
                            <h3 className="font-bold text-xl mb-2">{guide.title}</h3>
                            <p className="text-sm text-gray-600 mb-4">{game?.title || 'Unknown Game'}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="w-4 h-4" />
                                {guide.upvotes || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {guide.views || 0}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4">All Guides</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {allGuides.map((guide, index) => {
                const game = games.find(g => g.id === guide.game_id);
                return (
                  <motion.div
                    key={guide.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedGuide(guide)}>
                      <CardContent className="p-6">
                        <Badge className="mb-2">{guide.guide_type}</Badge>
                        <h3 className="font-bold text-lg mb-2">{guide.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{game?.title || 'Unknown Game'}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {guide.upvotes || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {guide.views || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}