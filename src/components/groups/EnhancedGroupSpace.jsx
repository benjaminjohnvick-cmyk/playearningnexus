import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, Calendar, Users, Image, Sparkles, Send, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EnhancedGroupSpace({ group, user }) {
  const [newMessage, setNewMessage] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['group-messages', group?.id],
    queryFn: async () => {
      return await base44.entities.ChatMessage.filter({ 
        guild_id: group.id 
      }, '-created_date', 50);
    },
    enabled: !!group
  });

  const { data: events = [] } = useQuery({
    queryKey: ['group-events', group?.id],
    queryFn: async () => {
      return await base44.entities.LiveEvent.filter({ 
        guild_id: group.id 
      }, '-start_time');
    },
    enabled: !!group
  });

  const { data: members = [] } = useQuery({
    queryKey: ['group-members', group?.id],
    queryFn: async () => {
      if (!group?.member_ids?.length) return [];
      return await base44.entities.User.filter({
        id: { $in: group.member_ids }
      });
    },
    enabled: !!group
  });

  const { data: mediaGallery = [] } = useQuery({
    queryKey: ['group-media', group?.id],
    queryFn: async () => {
      return await base44.entities.ChatMessage.filter({
        guild_id: group.id,
        message_type: 'image'
      }, '-created_date', 20);
    },
    enabled: !!group
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      return await base44.entities.ChatMessage.create({
        ...messageData,
        guild_id: group.id,
        user_id: user.id,
        user_name: user.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['group-messages']);
      setNewMessage('');
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData) => {
      return await base44.entities.LiveEvent.create({
        ...eventData,
        guild_id: group.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['group-events']);
      setShowEventForm(false);
      toast.success('Event created!');
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return await base44.entities.ChatMessage.create({
        guild_id: group.id,
        user_id: user.id,
        user_name: user.full_name,
        message: 'Shared an image',
        message_type: 'image',
        attachments: [{ file_url, file_type: 'image', file_name: file.name }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['group-messages']);
      queryClient.invalidateQueries(['group-media']);
      toast.success('Image uploaded!');
    }
  });

  const generateAISuggestions = async () => {
    setGeneratingSuggestions(true);
    try {
      const recentMessages = messages.slice(0, 20).map(m => m.message).join('\n');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this game group's activity and suggest relevant discussion topics and events:

Group: ${group.name}
Game: ${group.game_name || 'Multi-game'}
Members: ${members.length}
Recent Activity: ${recentMessages}

Provide:
1. 3 discussion topics that would engage members
2. 2 event ideas for group activities
3. Tips to boost group engagement`,
        response_json_schema: {
          type: "object",
          properties: {
            discussion_topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  description: { type: "string" }
                }
              }
            },
            event_ideas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  suggested_date: { type: "string" }
                }
              }
            },
            engagement_tips: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });
      
      setAiSuggestions(result);
    } catch (error) {
      toast.error('Failed to generate suggestions');
    }
    setGeneratingSuggestions(false);
  };

  useEffect(() => {
    if (group) {
      const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
        if (event.data.guild_id === group.id) {
          queryClient.invalidateQueries(['group-messages']);
        }
      });
      return unsubscribe;
    }
  }, [group]);

  const isLeader = group?.leader_id === user?.id;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl">{group?.name}</h2>
              <p className="text-sm opacity-90">{members.length} members</p>
            </div>
            <Button variant="secondary" onClick={generateAISuggestions} disabled={generatingSuggestions}>
              {generatingSuggestions ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              AI Suggestions
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* AI Suggestions */}
      {aiSuggestions && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Suggestions for Your Group
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Discussion Topics</h4>
              <div className="space-y-2">
                {aiSuggestions.discussion_topics.map((topic, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border">
                    <h5 className="font-medium mb-1">{topic.topic}</h5>
                    <p className="text-sm text-gray-600">{topic.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Event Ideas</h4>
              <div className="space-y-2">
                {aiSuggestions.event_ideas.map((event, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border">
                    <h5 className="font-medium mb-1">{event.title}</h5>
                    <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                    <p className="text-xs text-gray-500">Suggested: {event.suggested_date}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold mb-2">Engagement Tips</h4>
              <ul className="space-y-1">
                {aiSuggestions.engagement_tips.map((tip, idx) => (
                  <li key={idx} className="text-sm text-blue-900">• {tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="chat">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`p-3 rounded-lg ${msg.user_id === user.id ? 'bg-purple-50 ml-12' : 'bg-gray-50 mr-12'}`}>
                    <p className="font-semibold text-sm mb-1">{msg.user_name}</p>
                    <p className="text-sm">{msg.message}</p>
                    {msg.attachments?.[0]?.file_url && (
                      <img src={msg.attachments[0].file_url} className="mt-2 rounded-lg max-w-sm" />
                    )}
                    <p className="text-xs text-gray-500 mt-1">{new Date(msg.created_date).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      sendMessageMutation.mutate({ message: newMessage });
                    }
                  }}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="image-upload"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      uploadImageMutation.mutate(e.target.files[0]);
                    }
                  }}
                />
                <Button variant="outline" onClick={() => document.getElementById('image-upload').click()}>
                  <Image className="w-4 h-4" />
                </Button>
                <Button onClick={() => sendMessageMutation.mutate({ message: newMessage })} disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="pt-6">
              {isLeader && (
                <Button onClick={() => setShowEventForm(true)} className="mb-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              )}
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold">{event.title}</h4>
                      <Badge>{event.event_type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(event.start_time).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{member.full_name}</p>
                      <p className="text-sm text-gray-600">Level {member.level}</p>
                    </div>
                    {member.id === group.leader_id && (
                      <Badge className="bg-yellow-600">Leader</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3">
                {mediaGallery.map((msg) => (
                  <div key={msg.id} className="aspect-square rounded-lg overflow-hidden">
                    <img
                      src={msg.attachments?.[0]?.file_url}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Event Dialog */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            createEventMutation.mutate({
              title: formData.get('title'),
              description: formData.get('description'),
              event_type: 'special_challenge',
              start_time: new Date(formData.get('start')).toISOString(),
              end_time: new Date(formData.get('end')).toISOString()
            });
          }} className="space-y-4">
            <Input name="title" placeholder="Event Title" required />
            <Textarea name="description" placeholder="Description" />
            <Input name="start" type="datetime-local" required />
            <Input name="end" type="datetime-local" required />
            <Button type="submit" className="w-full">Create Event</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}