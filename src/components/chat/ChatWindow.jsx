import React, { useState, useEffect, useRef } from 'react';
import { chatMessageService } from '@/services';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Paperclip, X, Phone, Video } from 'lucide-react';
import MessageItem from './MessageItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function ChatWindow({
  conversationId,
  serviceRequest,
  onClose,
  showHeader = true,
  currentUser
}) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chatMessages', conversationId],
    queryFn: () => chatMessageService.getByConversationId(conversationId, 'created_at', 'asc'),
    enabled: !!conversationId,
    refetchInterval: 3000 // Poll every 3 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => chatMessageService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', conversationId] });
      setMessage('');
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const messageData = {
      conversation_id: conversationId,
      service_request_id: serviceRequest?.id,
      request_number: serviceRequest?.request_number,
      sender_user_id: currentUser?.id,
      sender_name: currentUser?.full_name || 'User',
      sender_role: currentUser?.user_role || 'client',
      message: message.trim(),
      message_type: 'text',
      read_by: [currentUser?.id]
    };

    sendMessageMutation.mutate(messageData);
  };

  const groupedMessages = messages.reverse().reduce((acc, msg, idx) => {
    const prevMsg = messages[idx - 1];
    const isLastInGroup = !prevMsg || prevMsg.sender_user_id !== msg.sender_user_id;
    acc.push({ ...msg, isLastInGroup });
    return acc;
  }, []);

  return (
    <Card data-source-location="components/chat/ChatWindow:72:4" data-dynamic-content="true" className="flex flex-col h-full">
      {showHeader &&
      <CardHeader data-source-location="components/chat/ChatWindow:74:8" data-dynamic-content="true" className="flex-row items-center justify-between py-4 border-b">
          <div data-source-location="components/chat/ChatWindow:75:10" data-dynamic-content="true">
            <CardTitle data-source-location="components/chat/ChatWindow:76:12" data-dynamic-content="true" className="text-base">
              {serviceRequest ? `SR #${serviceRequest.request_number}` : 'Chat'}
            </CardTitle>
            {serviceRequest &&
          <p data-source-location="components/chat/ChatWindow:80:14" data-dynamic-content="true" className="text-sm text-gray-500">{serviceRequest.client_name}</p>
          }
          </div>
          <div data-source-location="components/chat/ChatWindow:83:10" data-dynamic-content="true" className="flex items-center gap-2">
            <Button data-source-location="components/chat/ChatWindow:84:12" data-dynamic-content="false" variant="ghost" size="icon" className="text-gray-500">
              <Phone data-source-location="components/chat/ChatWindow:85:14" data-dynamic-content="false" className="w-4 h-4" />
            </Button>
            {onClose &&
          <Button data-source-location="components/chat/ChatWindow:88:14" data-dynamic-content="false" variant="ghost" size="icon" onClick={onClose}>
                <X data-source-location="components/chat/ChatWindow:89:16" data-dynamic-content="false" className="w-4 h-4" />
              </Button>
          }
          </div>
        </CardHeader>
      }

      <CardContent data-source-location="components/chat/ChatWindow:96:6" data-dynamic-content="true" className="flex-1 overflow-y-auto p-4 space-y-1" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {isLoading ?
        <div data-source-location="components/chat/ChatWindow:98:10" data-dynamic-content="false" className="flex items-center justify-center h-full">
            <LoadingSpinner data-source-location="components/chat/ChatWindow:99:12" data-dynamic-content="false" text="Loading messages..." />
          </div> :
        groupedMessages.length === 0 ?
        <EmptyState data-source-location="components/chat/ChatWindow:102:10" data-dynamic-content="false"
        title="No messages yet"
        description="Start the conversation" /> :


        <>
            {groupedMessages.map((msg) =>
          <MessageItem data-source-location="components/chat/ChatWindow:109:14" data-dynamic-content="false"
          key={msg.id}
          message={msg}
          currentUserId={currentUser?.id}
          isLastInGroup={msg.isLastInGroup} />

          )}
            <div data-source-location="components/chat/ChatWindow:116:12" data-dynamic-content="false" ref={messagesEndRef} />
          </>
        }
      </CardContent>

      <div data-source-location="components/chat/ChatWindow:121:6" data-dynamic-content="true" className="p-4 border-t">
        <div data-source-location="components/chat/ChatWindow:122:8" data-dynamic-content="true" className="flex gap-2">
          <Button data-source-location="components/chat/ChatWindow:123:10" data-dynamic-content="false" variant="ghost" size="icon" className="shrink-0">
            <Paperclip data-source-location="components/chat/ChatWindow:124:12" data-dynamic-content="false" className="w-4 h-4 text-gray-500" />
          </Button>
          <Input data-source-location="components/chat/ChatWindow:126:10" data-dynamic-content="false"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1" />

          <Button data-source-location="components/chat/ChatWindow:133:10" data-dynamic-content="false"
          onClick={handleSend}
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700">

            <Send data-source-location="components/chat/ChatWindow:138:12" data-dynamic-content="false" className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>);

}