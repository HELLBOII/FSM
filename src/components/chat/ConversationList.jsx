import React from 'react';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

export default function ConversationList({ conversations, selectedId, onSelect }) {
  return (
    <div data-source-location="components/chat/ConversationList:10:4" data-dynamic-content="true" className="space-y-2">
      {conversations.map((conv) => {
        const isSelected = conv.conversation_id === selectedId;
        const unreadCount = conv.unread_count || 0;

        return (
          <button data-source-location="components/chat/ConversationList:16:10" data-dynamic-content="true"
          key={conv.conversation_id}
          onClick={() => onSelect(conv)}
          className={cn(
            "w-full p-3 rounded-lg text-left transition-colors",
            isSelected ?
            "bg-emerald-50 border border-emerald-200" :
            "hover:bg-gray-50 border border-transparent"
          )}>

            <div data-source-location="components/chat/ConversationList:26:12" data-dynamic-content="true" className="flex items-start gap-3">
              <Avatar data-source-location="components/chat/ConversationList:27:14" data-dynamic-content="true" className="w-10 h-10">
                <AvatarFallback data-source-location="components/chat/ConversationList:28:16" data-dynamic-content="true" className="bg-blue-100 text-blue-700">
                  {conv.participant_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div data-source-location="components/chat/ConversationList:33:14" data-dynamic-content="true" className="flex-1 min-w-0">
                <div data-source-location="components/chat/ConversationList:34:16" data-dynamic-content="true" className="flex items-center justify-between mb-1">
                  <p data-source-location="components/chat/ConversationList:35:18" data-dynamic-content="true" className="font-medium text-gray-900 truncate">
                    {conv.participant_name}
                  </p>
                  <span data-source-location="components/chat/ConversationList:38:18" data-dynamic-content="true" className="text-xs text-gray-500">
                    {conv.last_message_time && format(new Date(conv.last_message_time), 'MMM d')}
                  </span>
                </div>
                
                {conv.request_number &&
                <p data-source-location="components/chat/ConversationList:44:18" data-dynamic-content="true" className="text-xs text-gray-500 mb-1">SR #{conv.request_number}</p>
                }
                
                <div data-source-location="components/chat/ConversationList:47:16" data-dynamic-content="true" className="flex items-center justify-between">
                  <p data-source-location="components/chat/ConversationList:48:18" data-dynamic-content="true" className="text-sm text-gray-600 truncate">
                    {conv.last_message || 'No messages yet'}
                  </p>
                  {unreadCount > 0 &&
                  <Badge data-source-location="components/chat/ConversationList:52:20" data-dynamic-content="true" className="bg-emerald-500 text-white ml-2 shrink-0">
                      {unreadCount}
                    </Badge>
                  }
                </div>
              </div>
            </div>
          </button>);

      })}
      
      {conversations.length === 0 &&
      <div data-source-location="components/chat/ConversationList:64:8" data-dynamic-content="false" className="text-center py-12 text-gray-500">
          <MessageSquare data-source-location="components/chat/ConversationList:65:10" data-dynamic-content="false" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p data-source-location="components/chat/ConversationList:66:10" data-dynamic-content="false">No conversations yet</p>
        </div>
      }
    </div>);

}