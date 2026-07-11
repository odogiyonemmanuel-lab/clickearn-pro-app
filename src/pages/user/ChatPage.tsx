import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  MessageSquare, Send, ArrowLeft, Trash2, Loader2, MessagesSquare,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { cn, formatRelativeTime } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ConversationDoc = {
  _id: string;
  participants: string[];
  listingId?: string;
  lastMessageAt: number;
  lastMessageText?: string;
  isArchived: boolean;
  otherParticipant: { name: string | null; image: string | null } | null;
  unreadCount: number;
  isBlocked: boolean;
};

type MessageDoc = {
  _id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  type: "text" | "image" | "system";
  isRead: boolean;
  readAt?: number;
  deletedAt?: number;
  createdAt: number;
};

type MessagesResult = {
  page: MessageDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-dark-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            i % 2 === 0 ? "justify-start" : "justify-end"
          )}
        >
          <div className="skeleton h-12 w-48 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const conversations = useQuery(api.chat.getMyConversations as any) as
    | ConversationDoc[]
    | undefined;

  const messagesResult = useQuery(
    api.messages.getMessages as any,
    id ? { conversationId: id, limit: 100 } : "skip"
  ) as MessagesResult | undefined;

  const sendMessage = useMutation(api.messages.sendMessage as any);
  const deleteMessage = useMutation(api.messages.deleteMessage as any);
  const markRead = useMutation(api.chat.markConversationRead as any);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markReadRef = useRef<string | null>(null);

  const messages = messagesResult?.page ?? [];
  const activeConversation = conversations?.find((c) => c._id === id);

  /* ---------- Auto-scroll to bottom on new messages ---------- */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  /* ---------- Mark conversation as read when opened ---------- */
  useEffect(() => {
    if (!id || id === markReadRef.current) return;
    markReadRef.current = id;
    setMobileView("thread");
    (async () => {
      try {
        await markRead({ conversationId: id });
      } catch {
        /* non-fatal */
      }
    })();
  }, [id, markRead]);

  /* ---------- Select a conversation ---------- */
  const handleSelectConversation = (convId: string) => {
    navigate(`/chat/${convId}`);
  };

  const handleBackToList = () => {
    setMobileView("list");
    navigate("/chat");
  };

  /* ---------- Send message ---------- */
  const handleSend = useCallback(async () => {
    if (!id || !draft.trim() || isSending) return;
    const text = draft.trim();
    setDraft("");
    setIsSending(true);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await sendMessage({ conversationId: id, text });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send message");
      setDraft(text); // restore draft on failure
    } finally {
      setIsSending(false);
    }
  }, [id, draft, isSending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---------- Auto-grow textarea ---------- */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  /* ---------- Delete message ---------- */
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage({ messageId });
      toast.success("Message deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete message");
    }
  };

  const isLoadingConversations = conversations === undefined;
  const isLoadingMessages = id !== undefined && messagesResult === undefined;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 overflow-hidden">
      {/* ---------- Left panel: conversation list ---------- */}
      <div
        className={cn(
          "card flex w-full flex-col overflow-hidden lg:w-80 xl:w-96",
          mobileView === "thread" && id && "hidden lg:flex"
        )}
      >
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Messages</h2>
          <MessageSquare className="h-4 w-4 text-dark-400" />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoadingConversations ? (
            <ConversationListSkeleton />
          ) : !conversations || conversations.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No conversations"
              description="Start chatting with a seller from a marketplace listing."
            />
          ) : (
            <ul className="divide-y divide-dark-800">
              {conversations.map((conv) => {
                const isActive = conv._id === id;
                return (
                  <li key={conv._id}>
                    <button
                      onClick={() => handleSelectConversation(conv._id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                        isActive
                          ? "bg-primary-600/15"
                          : "hover:bg-dark-800/50"
                      )}
                    >
                      <Avatar
                        name={conv.otherParticipant?.name ?? "User"}
                        src={conv.otherParticipant?.image ?? undefined}
                        size="md"
                        online={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p
                            className={cn(
                              "truncate text-sm",
                              isActive
                                ? "font-semibold text-primary-300"
                                : "font-medium text-white"
                            )}
                          >
                            {conv.otherParticipant?.name ?? "Unknown user"}
                          </p>
                          <span className="ml-2 shrink-0 text-xs text-dark-500">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-dark-500">
                            {conv.lastMessageText || "No messages yet"}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white">
                              {conv.unreadCount > 99
                                ? "99+"
                                : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Right panel: message thread ---------- */}
      <div
        className={cn(
          "card flex flex-1 flex-col overflow-hidden",
          mobileView === "list" && !id && "hidden lg:flex"
        )}
      >
        {!id ? (
          <EmptyState
            icon={MessageSquare}
            title="Select a conversation"
            description="Choose a conversation from the list to start chatting."
          />
        ) : isLoadingMessages ? (
          <ThreadSkeleton />
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-dark-800 px-4 py-3">
              <button
                onClick={handleBackToList}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white lg:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar
                name={activeConversation?.otherParticipant?.name ?? "User"}
                src={
                  activeConversation?.otherParticipant?.image ?? undefined
                }
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {activeConversation?.otherParticipant?.name ?? "Unknown user"}
                </p>
                {activeConversation?.isBlocked && (
                  <p className="text-xs text-error-400">You blocked this user</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-dark-500">
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === user?._id;
                  const isDeleted = msg.deletedAt !== undefined;
                  return (
                    <div
                      key={msg._id}
                      className={cn(
                        "flex group",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                          isOwn
                            ? "rounded-br-md bg-primary-600 text-white"
                            : "rounded-bl-md bg-dark-800 text-dark-100"
                        )}
                      >
                        {/* Image or text */}
                        {isDeleted ? (
                          <p
                            className={cn(
                              "italic",
                              isOwn ? "text-primary-200" : "text-dark-500"
                            )}
                          >
                            🗑️ Message deleted
                          </p>
                        ) : msg.imageUrl ? (
                          <img
                            src={msg.imageUrl}
                            alt="Shared image"
                            className="max-h-60 max-w-full rounded-lg object-cover"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        )}

                        {/* Timestamp + delete */}
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-2 text-[10px]",
                            isOwn ? "text-primary-200" : "text-dark-500"
                          )}
                        >
                          <span>{formatRelativeTime(msg.createdAt)}</span>
                          {isOwn && !isDeleted && (
                            <button
                              onClick={() => handleDeleteMessage(msg._id)}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-dark-800 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="input max-h-32 flex-1 resize-none py-2.5"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || isSending}
                  className="btn btn-primary shrink-0"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
