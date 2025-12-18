import { useRef, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, X, Bot, User, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useChat } from "@/contexts/ChatContext";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestAgent?: boolean;
  timestamp: Date;
}

interface PropertyContext {
  listingId?: string;
  address?: string;
  city?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  status?: string;
}

interface ChatAssistantProps {
  propertyContext?: PropertyContext;
}

export function ChatAssistant({ propertyContext }: ChatAssistantProps) {
  const { isOpen, openChat, closeChat } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: chatStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/chat/status"],
    staleTime: 60000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage }
      ];
      
      const response = await apiRequest("/api/chat", "POST", {
        messages: apiMessages,
        propertyContext,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }
      
      return response.json();
    },
    onSuccess: (data, userMessage) => {
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { 
          role: "assistant", 
          content: data.message, 
          suggestAgent: data.suggestAgent,
          timestamp: new Date() 
        },
      ]);
      setInputValue("");
    },
    onError: (error: Error, userMessage) => {
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { 
          role: "assistant", 
          content: "I'm sorry, I encountered an error. Please try again.",
          timestamp: new Date() 
        },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessageMutation.isPending]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const message = inputValue.trim();
    if (!message || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isConfigured = chatStatus?.configured ?? false;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={openChat}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-[9999] bg-primary hover:bg-primary/90"
          data-testid="button-chat-open"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 w-96 h-[32rem] bg-background border rounded-lg shadow-xl z-[9999] flex flex-col overflow-hidden"
          data-testid="dialog-chat"
        >
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">Spyglass Assistant</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChat}
              className="text-primary-foreground hover:bg-primary-foreground/20"
              data-testid="button-chat-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!isConfigured ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div className="space-y-3">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  AI assistant is not configured. Please add your OpenAI API key in the settings.
                </p>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea 
                ref={scrollRef}
                className="flex-1 p-4"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                    <p className="text-sm">
                      Hi! I'm your Spyglass Realty assistant. Ask me about properties, neighborhoods, or the Austin real estate market.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex gap-3",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                        data-testid={`message-${msg.role}-${idx}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-2",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.suggestAgent && (
                            <Badge 
                              variant="secondary" 
                              className="mt-2 cursor-pointer hover-elevate"
                              data-testid="badge-contact-agent"
                            >
                              Contact an Agent
                            </Badge>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {sendMessageMutation.isPending && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about properties..."
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sendMessageMutation.isPending}
                    size="icon"
                    data-testid="button-chat-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
