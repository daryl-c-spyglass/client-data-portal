import { useRef, useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle, Send, X, Bot, User, Loader2, AlertCircle, Search, Mic, MicOff, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/hooks/use-toast";

interface SearchCriteria {
  location?: string;
  propertyType?: string;
  beds?: number;
  baths?: number;
  minSqft?: number;
  minPrice?: number;
  maxPrice?: number;
}

interface CmaCriteria {
  area: string;
  sqftMin?: number;
  sqftMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  stories?: 1 | 2 | 3 | "any";
}

type ChatIntent = "IDX_SEARCH" | "CMA_INTAKE" | "OTHER";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: ChatIntent;
  suggestAgent?: boolean;
  readyToSearch?: boolean;
  searchCriteria?: SearchCriteria;
  readyToCreateCmaDraft?: boolean;
  cmaCriteria?: CmaCriteria;
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

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventInit extends EventInit {
  resultIndex?: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export function ChatAssistant({ propertyContext }: ChatAssistantProps) {
  const { isOpen, openChat, closeChat } = useChat();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingSearch, setPendingSearch] = useState<SearchCriteria | null>(null);
  const [pendingCmaDraft, setPendingCmaDraft] = useState<CmaCriteria | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);
    
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setInputValue(finalTranscript);
        } else if (interimTranscript) {
          setInputValue(interimTranscript);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputValue('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

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
          intent: data.intent,
          suggestAgent: data.suggestAgent,
          readyToSearch: data.readyToSearch,
          searchCriteria: data.searchCriteria,
          readyToCreateCmaDraft: data.readyToCreateCmaDraft,
          cmaCriteria: data.cmaCriteria,
          timestamp: new Date() 
        },
      ]);
      setInputValue("");
      
      if (data.readyToSearch && data.searchCriteria) {
        setPendingSearch(data.searchCriteria);
      }
      if (data.readyToCreateCmaDraft && data.cmaCriteria) {
        setPendingCmaDraft(data.cmaCriteria);
      }
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

  const createCmaDraftMutation = useMutation({
    mutationFn: async (criteria: CmaCriteria) => {
      const response = await apiRequest("/api/cmas/draft", "POST", criteria);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create CMA draft");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setPendingCmaDraft(null);
      setMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: `Great! I've created your CMA draft for ${data.message?.replace("CMA draft created for ", "") || "the selected area"}. You can now add your subject property and select comparables.`,
          timestamp: new Date() 
        },
      ]);
      toast({
        title: "CMA Draft Created",
        description: "Navigating to your new CMA draft...",
      });
      closeChat();
      setLocation(data.url);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCmaDraft = (criteria: CmaCriteria) => {
    createCmaDraftMutation.mutate(criteria);
  };

  const handleCancelCmaDraft = () => {
    setPendingCmaDraft(null);
    setMessages(prev => [
      ...prev,
      { 
        role: "assistant", 
        content: "No problem! Let me know if you'd like to start over or need anything else.",
        timestamp: new Date() 
      },
    ]);
  };

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

  const initiateSearch = (criteria: SearchCriteria) => {
    const params = new URLSearchParams();
    
    if (criteria.location) {
      if (/^\d{5}$/.test(criteria.location)) {
        params.set("postalCode", criteria.location);
      } else {
        params.set("city", criteria.location);
      }
    }
    if (criteria.propertyType) params.set("propertySubType", criteria.propertyType);
    if (criteria.beds) params.set("bedsMin", criteria.beds.toString());
    if (criteria.baths) params.set("bathsMin", criteria.baths.toString());
    if (criteria.minSqft) params.set("sqftMin", criteria.minSqft.toString());
    if (criteria.minPrice) params.set("priceMin", criteria.minPrice.toString());
    if (criteria.maxPrice) params.set("priceMax", criteria.maxPrice.toString());
    
    closeChat();
    setPendingSearch(null);
    setLocation(`/buyer-search?${params.toString()}`);
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
        <>
          {/* Mobile backdrop overlay - tap to close */}
          <div 
            className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
            onClick={closeChat}
            data-testid="backdrop-chat-close"
          />
          
          <div 
            className="fixed inset-4 md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[32rem] bg-background border rounded-lg shadow-xl z-[9999] flex flex-col overflow-hidden"
            data-testid="dialog-chat"
          >
            <div className="flex items-center justify-between p-3 md:p-4 border-b bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="font-semibold">Spyglass Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeChat}
                className="text-primary-foreground hover:bg-primary-foreground/20 h-10 w-10 md:h-9 md:w-9"
                data-testid="button-chat-close"
              >
                <X className="h-5 w-5 md:h-4 md:w-4" />
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
                          {msg.readyToSearch && msg.searchCriteria && (
                            <Button
                              size="sm"
                              className="mt-2 gap-1"
                              onClick={() => initiateSearch(msg.searchCriteria!)}
                              data-testid="button-search-now"
                            >
                              <Search className="h-3 w-3" />
                              Search Now
                            </Button>
                          )}
                          {msg.readyToCreateCmaDraft && msg.cmaCriteria && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                className="gap-1"
                                onClick={() => handleCreateCmaDraft(msg.cmaCriteria!)}
                                disabled={createCmaDraftMutation.isPending}
                                data-testid="button-create-cma-draft"
                              >
                                {createCmaDraftMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <FileText className="h-3 w-3" />
                                )}
                                Create Draft
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelCmaDraft}
                                disabled={createCmaDraftMutation.isPending}
                                data-testid="button-cancel-cma-draft"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
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
                    placeholder={isListening ? "Listening..." : "Ask about properties..."}
                    disabled={sendMessageMutation.isPending}
                    className={isListening ? "border-primary animate-pulse" : ""}
                    data-testid="input-chat-message"
                  />
                  {speechSupported && (
                    <Button
                      onClick={toggleListening}
                      disabled={sendMessageMutation.isPending}
                      size="icon"
                      variant={isListening ? "default" : "outline"}
                      className={isListening ? "bg-red-500 hover:bg-red-600" : ""}
                      data-testid="button-chat-voice"
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
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
        </>
      )}
    </>
  );
}
