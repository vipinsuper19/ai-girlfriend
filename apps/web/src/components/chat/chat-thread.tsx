"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Clock, Mic, Send } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import { readSse } from "@/lib/sse";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Companion, Conversation, Message } from "@/types/api";

type ThreadMessage = Message & { clientId?: string };

export function ChatThread({
  companion,
  conversation,
  conversations,
  initialMessages,
}: {
  companion: Companion;
  conversation: Conversation;
  conversations: Conversation[];
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("Active now");
  const [offline, setOffline] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef("");

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    const clientId = `tmp-${Date.now()}`;
    const optimistic: ThreadMessage = {
      id: clientId,
      clientId,
      conversationId: conversation.id,
      role: "USER",
      type: "TEXT",
      content,
      createdAt: new Date().toISOString(),
      status: "sending",
      optimistic: true,
    };
    setMessages((current) => [...current, optimistic]);
    setSending(true);
    setStatus("Typing…");
    bufferRef.current = "";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(
        `/api/bff/conversations/${conversation.id}/messages/stream`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, type: "TEXT" }),
          signal: controller.signal,
        },
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        throw new Error("Stream unavailable");
      }

      let streamId: string | number | null = null;
      for await (const event of readSse(response)) {
        if (event.event === "message") {
          const payload = event.data as { message?: Message };
          if (payload.message) {
            setMessages((current) =>
              current.map((item) =>
                item.clientId === clientId
                  ? { ...payload.message!, status: "sent" }
                  : item,
              ),
            );
          }
        }
        if (event.event === "delta") {
          const payload = event.data as { content?: string };
          bufferRef.current += payload.content ?? "";
          const text = bufferRef.current;
          setMessages((current) => {
            const withoutStream = current.filter((item) => item.id !== "stream");
            return [
              ...withoutStream,
              {
                id: "stream",
                conversationId: conversation.id,
                role: "ASSISTANT",
                type: "TEXT",
                content: text,
                createdAt: new Date().toISOString(),
                status: "streaming",
              },
            ];
          });
        }
        if (event.event === "done") {
          const payload = event.data as { message?: Message };
          if (payload.message) {
            streamId = payload.message.id;
            setMessages((current) => [
              ...current.filter((item) => item.id !== "stream"),
              { ...payload.message!, status: "sent" },
            ]);
          }
        }
        if (event.event === "error") {
          throw new Error("The reply failed mid-stream");
        }
      }
      void streamId;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMessages((current) => current.filter((item) => item.id !== "stream"));
      } else {
        setMessages((current) =>
          current.map((item) =>
            item.clientId === clientId ? { ...item, status: "failed" } : item,
          ),
        );
      }
    } finally {
      setSending(false);
      setStatus("Active now");
      abortRef.current = null;
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && window.innerWidth >= 768) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-0 md:h-[100dvh]">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-outline-variant lg:flex">
        <div className="p-4 font-semibold">Conversations</div>
        <ConversationList
          conversations={conversations}
          activeId={conversation.id}
        />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
          <Avatar name={companion.name} src={companion.appearance?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <Link href={`/companion/${companion.id}`} className="font-semibold">
              {companion.name}
            </Link>
            <p className="text-xs text-on-surface-variant">{status}</p>
          </div>
          <Link
            href="/chat/history"
            className="rounded-full p-2 text-on-surface-variant hover:bg-[var(--state-hover)] lg:hidden"
            aria-label="Conversation history"
          >
            <Clock className="size-5" />
          </Link>
        </header>
        {offline ? (
          <Banner tone="warning" className="rounded-none">
            You're offline. History still works; sends will retry.
          </Banner>
        ) : null}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const gap =
              previous &&
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() >
                5 * 60 * 1000;
            return (
              <div key={String(message.id)}>
                {gap ? (
                  <p className="mb-2 text-center text-xs text-on-surface-variant">
                    {formatRelativeTime(message.createdAt)}
                  </p>
                ) : null}
                <Bubble message={message} />
              </div>
            );
          })}
        </div>
        <form
          className="mx-auto flex w-full max-w-[44rem] items-end gap-2 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message ${companion.name}`}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-base"
          />
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant"
            aria-label="Voice note — not available yet"
            title="Voice needs a supported audio format on the server"
            disabled
          >
            <Mic className="size-5" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              input.trim()
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant",
            )}
            aria-label="Send"
          >
            <Send className="size-5" />
          </button>
        </form>
      </section>
    </div>
  );
}

function Bubble({ message }: { message: ThreadMessage }) {
  const outgoing = message.role === "USER";
  return (
    <div className={cn("flex flex-col", outgoing ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[68ch] px-4 py-3 text-base leading-6",
          outgoing
            ? "rounded-[20px] rounded-br-sm bg-bubble-outgoing text-on-bubble-outgoing"
            : "rounded-[20px] rounded-bl-sm bg-bubble-incoming text-on-bubble-incoming",
          message.status === "sending" && "opacity-55",
          message.status === "failed" && "opacity-55",
        )}
      >
        {message.content}
        {message.status === "streaming" ? (
          <span aria-hidden className="ml-0.5 inline-block w-2 animate-pulse">
            ▍
          </span>
        ) : null}
      </div>
      {message.status === "failed" ? (
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-error"
          onClick={() => undefined}
        >
          Not sent · Retry
        </button>
      ) : null}
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
}: {
  conversations: Conversation[];
  activeId?: number;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {conversations.map((item) => (
        <Link
          key={item.id}
          href={`/chat/${item.id}`}
          className={cn(
            "px-4 py-3 text-sm",
            item.id === activeId
              ? "bg-surface-container-low"
              : "hover:bg-[var(--state-hover)]",
          )}
        >
          <div className="font-semibold">{item.title || "Conversation"}</div>
          <div className="text-xs text-on-surface-variant">
            {formatRelativeTime(item.lastMessageAt ?? item.createdAt)}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function HistoryList({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const router = useRouter();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-6">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <ConversationList conversations={conversations} />
      <button
        type="button"
        className="mt-6 h-11 rounded-full bg-primary font-semibold text-on-primary"
        onClick={async () => {
          const companions = await api<Companion[]>("/avatars");
          const companion = companions[0];
          if (!companion) return;
          const created = await api<Conversation>("/conversations", {
            method: "POST",
            body: { companionId: companion.id },
          });
          router.push(`/chat/${created.id}`);
        }}
      >
        Start a new conversation
      </button>
    </div>
  );
}
