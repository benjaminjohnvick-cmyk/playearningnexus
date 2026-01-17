import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Paperclip, 
  X, 
  Image as ImageIcon, 
  FileText,
  Search,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function EnhancedChatWidget({ recipientId, recipientName, currentUser }) {
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chatMessages', currentUser?.id, recipientId],
    queryFn: async () => {
      const sent = await base44.entities.ChatMessage.filter(
        { sender_user_id: currentUser.id, recipient_user_id: recipientId },
        '-created_date',
        100
      );
      const received = await base44.entities.ChatMessage.filter(
        { sender_user_id: recipientId, recipient_user_id: currentUser.id },
        '-created_date',
        100
      );
      return [...sent, ...received].sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
    },
    enabled: !!currentUser && !!recipientId,
    refetchInterval: 3000
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!currentUser || !recipientId) return;
    
    const unreadMessages = messages.filter(
      m => m.sender_user_id === recipientId && 
           m.recipient_user_id === currentUser.id && 
           !m.is_read
    );

    unreadMessages.forEach(msg => {
      base44.entities.ChatMessage.update(msg.id, { 
        is_read: true, 
        read_at: new Date().toISOString() 
      });
    });
  }, [messages, currentUser, recipientId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      await base44.entities.ChatMessage.create(messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['chatMessages']);
      setMessage('');
      setAttachments([]);
    }
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsUploading(true);

    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            file_url,
            file_name: file.name,
            file_type: file.type
          };
        })
      );

      setAttachments([...attachments, ...uploadedFiles]);
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() && attachments.length === 0) return;

    const messageType = attachments.some(a => a.file_type?.startsWith('image/')) 
      ? 'image' 
      : attachments.length > 0 
      ? 'file' 
      : 'text';

    sendMessageMutation.mutate({
      sender_user_id: currentUser.id,
      recipient_user_id: recipientId,
      user_name: currentUser.full_name,
      message: message || '(attachment)',
      message_type: messageType,
      attachments,
      is_read: false
    });
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const filteredMessages = searchQuery
    ? messages.filter(m => 
        m.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat with {recipientName}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48 h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {filteredMessages.map((msg) => {
            const isMine = msg.sender_user_id === currentUser?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isMine
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold mb-1">{msg.user_name}</p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                  
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {attachment.file_type?.startsWith('image/') ? (
                            <img 
                              src={attachment.file_url} 
                              alt={attachment.file_name}
                              className="max-w-full rounded"
                            />
                          ) : (
                            <a
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded ${
                                isMine ? 'bg-blue-700' : 'bg-gray-200'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              <span className="text-xs">{attachment.file_name}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(msg.created_date).toLocaleTimeString()}
                    </p>
                    {isMine && msg.is_read && (
                      <CheckCheck className="w-4 h-4 text-blue-200" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, idx) => (
              <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                {attachment.file_type?.startsWith('image/') ? (
                  <ImageIcon className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                <span className="text-xs max-w-[100px] truncate">
                  {attachment.file_name}
                </span>
                <button onClick={() => removeAttachment(idx)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={sendMessageMutation.isPending || (!message.trim() && attachments.length === 0)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}