import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatWindow from './ChatWindow';

export default function MobileChatButton({ serviceRequest, conversationId, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button data-source-location="components/chat/MobileChatButton:12:6" data-dynamic-content="false"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 z-50"
      size="icon">

        <MessageCircle data-source-location="components/chat/MobileChatButton:17:8" data-dynamic-content="false" className="w-6 h-6" />
      </Button>

      <Sheet data-source-location="components/chat/MobileChatButton:20:6" data-dynamic-content="true" open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent data-source-location="components/chat/MobileChatButton:21:8" data-dynamic-content="true" side="bottom" className="h-[85vh] p-0">
          <div data-source-location="components/chat/MobileChatButton:22:10" data-dynamic-content="true" className="h-full flex flex-col">
            <SheetHeader data-source-location="components/chat/MobileChatButton:23:12" data-dynamic-content="true" className="p-4 border-b">
              <div data-source-location="components/chat/MobileChatButton:24:14" data-dynamic-content="true" className="flex items-center justify-between">
                <div data-source-location="components/chat/MobileChatButton:25:16" data-dynamic-content="true">
                  <SheetTitle data-source-location="components/chat/MobileChatButton:26:18" data-dynamic-content="false">Chat with Client</SheetTitle>
                  {serviceRequest &&
                  <p data-source-location="components/chat/MobileChatButton:28:20" data-dynamic-content="true" className="text-sm text-gray-500">SR #{serviceRequest.request_number}</p>
                  }
                </div>
                <Button data-source-location="components/chat/MobileChatButton:31:16" data-dynamic-content="false" variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X data-source-location="components/chat/MobileChatButton:32:18" data-dynamic-content="false" className="w-5 h-5" />
                </Button>
              </div>
            </SheetHeader>
            
            <div data-source-location="components/chat/MobileChatButton:37:12" data-dynamic-content="true" className="flex-1 overflow-hidden">
              <ChatWindow data-source-location="components/chat/MobileChatButton:38:14" data-dynamic-content="false"
              conversationId={conversationId}
              serviceRequest={serviceRequest}
              currentUser={currentUser}
              showHeader={false} />

            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>);

}