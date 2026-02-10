import React, { useState, useMemo } from 'react';
import { chatMessageService, serviceRequestService } from '@/services';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PageHeader from '@/components/common/PageHeader';
import ChatWindow from '@/components/chat/ChatWindow';
import ConversationList from '@/components/chat/ConversationList';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuth();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['allMessages'],
    queryFn: async () => {
      // Get all messages by fetching from all conversations
      // Note: This is a simplified approach. In production, you might want to optimize this
      const allMessages = [];
      // TODO: Implement a better way to get all messages across conversations
      return allMessages;
    },
    enabled: !!user
  });

  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['serviceRequests'],
    queryFn: () => serviceRequestService.list('created_at', 'desc', 200)
  });

  // Group messages by conversation
  const conversations = useMemo(() => {
    const convMap = new Map();

    messages.forEach((msg) => {
      const convId = msg.conversation_id;
      if (!convMap.has(convId)) {
        const sr = serviceRequests.find((r) => r.id === msg.service_request_id);

        // Determine participant name (the other person in conversation)
        let participantName = msg.sender_name;
        if (msg.sender_user_id === user?.id) {
          // This is my message, need to find the other participant
          const otherMsg = messages.find((m) =>
          m.conversation_id === convId &&
          m.sender_user_id !== user?.id
          );
          participantName = otherMsg?.sender_name || sr?.client_name || 'Unknown';
        }

        convMap.set(convId, {
          conversation_id: convId,
          service_request_id: msg.service_request_id,
          request_number: msg.request_number,
          participant_name: participantName,
          last_message: msg.message,
          last_message_time: msg.created_at || msg.created_date,
          unread_count: 0,
          service_request: sr
        });
      }
    });

    return Array.from(convMap.values()).sort((a, b) =>
    new Date(b.last_message_time) - new Date(a.last_message_time)
    );
  }, [messages, serviceRequests, user]);

  const filteredConversations = conversations.filter((conv) =>
  conv.participant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  conv.request_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div data-source-location="pages/Messages:78:6" data-dynamic-content="false" className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner data-source-location="pages/Messages:79:8" data-dynamic-content="false" size="lg" text="Loading messages..." />
      </div>);

  }

  return (
    <div data-source-location="pages/Messages:85:4" data-dynamic-content="true" className="space-y-6">
      <PageHeader data-source-location="pages/Messages:86:6" data-dynamic-content="false"
      title="Messages"
      subtitle="Communicate with clients and technicians"
      icon={MessageSquare} />


      <div data-source-location="pages/Messages:92:6" data-dynamic-content="true" className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Conversation List */}
        <Card data-source-location="pages/Messages:94:8" data-dynamic-content="true" className="lg:col-span-1 p-4 overflow-y-auto">
          <div data-source-location="pages/Messages:95:10" data-dynamic-content="true" className="mb-4">
            <div data-source-location="pages/Messages:96:12" data-dynamic-content="true" className="relative">
              <Search data-source-location="pages/Messages:97:14" data-dynamic-content="false" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input data-source-location="pages/Messages:98:14" data-dynamic-content="false"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9" />

            </div>
          </div>
          
          <ConversationList data-source-location="pages/Messages:107:10" data-dynamic-content="false"
          conversations={filteredConversations}
          selectedId={selectedConversation?.conversation_id}
          onSelect={setSelectedConversation} />

        </Card>

        {/* Chat Window */}
        <div data-source-location="pages/Messages:115:8" data-dynamic-content="true" className="lg:col-span-2">
          {selectedConversation ?
          <ChatWindow data-source-location="pages/Messages:117:12" data-dynamic-content="false"
          conversationId={selectedConversation.conversation_id}
          serviceRequest={selectedConversation.service_request}
          currentUser={user}
          showHeader={true} /> :


          <Card data-source-location="pages/Messages:124:12" data-dynamic-content="false" className="h-full flex items-center justify-center">
              <div data-source-location="pages/Messages:125:14" data-dynamic-content="false" className="text-center text-gray-500">
                <MessageSquare data-source-location="pages/Messages:126:16" data-dynamic-content="false" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p data-source-location="pages/Messages:127:16" data-dynamic-content="false" className="text-lg font-medium">Select a conversation</p>
                <p data-source-location="pages/Messages:128:16" data-dynamic-content="false" className="text-sm">Choose a conversation from the list to start messaging</p>
              </div>
            </Card>
          }
        </div>
      </div>
    </div>);

}