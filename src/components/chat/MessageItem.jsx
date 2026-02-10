import React from 'react';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

export default function MessageItem({ message, currentUserId, isLastInGroup }) {
  const isOwnMessage = message.sender_user_id === currentUserId;
  const timestamp = message.created_at || message.created_date || new Date();
  const isRead = message.read_by?.includes(currentUserId);

  if (message.message_type === 'system') {
    return (
      <div data-source-location="components/chat/MessageItem:14:6" data-dynamic-content="true" className="flex justify-center my-4">
        <p data-source-location="components/chat/MessageItem:15:8" data-dynamic-content="true" className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.message}
        </p>
      </div>);

  }

  return (
    <div data-source-location="components/chat/MessageItem:23:4" data-dynamic-content="true" className={cn(
      "flex gap-2 mb-1",
      isOwnMessage ? "justify-end" : "justify-start",
      isLastInGroup && "mb-4"
    )}>
      {!isOwnMessage &&
      <Avatar data-source-location="components/chat/MessageItem:29:8" data-dynamic-content="true" className="w-8 h-8 mt-1">
          <AvatarFallback data-source-location="components/chat/MessageItem:30:10" data-dynamic-content="true" className="bg-blue-100 text-blue-700 text-xs">
            {message.sender_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      }
      
      <div data-source-location="components/chat/MessageItem:36:6" data-dynamic-content="true" className={cn(
        "max-w-[75%] flex flex-col",
        isOwnMessage ? "items-end" : "items-start"
      )}>
        {isLastInGroup && !isOwnMessage &&
        <p data-source-location="components/chat/MessageItem:41:10" data-dynamic-content="true" className="text-xs text-gray-500 mb-1 px-2">
            {message.sender_name}
          </p>
        }
        
        <div data-source-location="components/chat/MessageItem:46:8" data-dynamic-content="true" className={cn(
          "px-4 py-2 rounded-2xl break-words",
          isOwnMessage ?
          "bg-emerald-600 text-white rounded-br-md" :
          "bg-gray-100 text-gray-900 rounded-bl-md"
        )}>
          <p data-source-location="components/chat/MessageItem:52:10" data-dynamic-content="true" className="text-sm whitespace-pre-wrap">{message.message}</p>
        </div>
        
        <div data-source-location="components/chat/MessageItem:55:8" data-dynamic-content="true" className={cn(
          "flex items-center gap-1 mt-1 px-2",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}>
          <p data-source-location="components/chat/MessageItem:59:10" data-dynamic-content="true" className="text-xs text-gray-400">
            {format(new Date(timestamp), 'HH:mm')}
          </p>
          {isOwnMessage && (
          isRead ?
          <CheckCheck data-source-location="components/chat/MessageItem:64:14" data-dynamic-content="false" className="w-3 h-3 text-emerald-500" /> :
          <Check data-source-location="components/chat/MessageItem:65:14" data-dynamic-content="false" className="w-3 h-3 text-gray-400" />)
          }
        </div>
      </div>
    </div>);

}