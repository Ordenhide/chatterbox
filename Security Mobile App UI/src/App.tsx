import { useState, useEffect, useRef } from "react";

// ─── Data ────────────────────────────────────────────────────────────────────

const CONTACTS = [
  {
    id: "c1",
    handle: "GHOST_NODE",
    key: "0xA3F9...B12E",
    status: "ONLINE",
    lastMsg: "Exfil window closes at 0400. Confirm receipt.",
    lastTime: "04:11",
    unread: 2,
    verified: true,
    avatar: "GN",
  },
  {
    id: "c2",
    handle: "CIPHER_7",
    key: "0x77D2...9C01",
    status: "ONLINE",
    lastMsg: "New signing cert pushed to keyring.",
    lastTime: "03:58",
    unread: 0,
    verified: true,
    avatar: "C7",
  },
  {
    id: "c3",
    handle: "RAVEN_NULL",
    key: "0xEE14...4F7A",
    status: "AWAY",
    lastMsg: "████████████ [DECRYPTED]",
    lastTime: "02:34",
    unread: 1,
    verified: true,
    avatar: "RN",
  },
  {
    id: "c4",
    handle: "VOID_SIGNAL",
    key: "0x5501...CC3B",
    status: "OFFLINE",
    lastMsg: "Message self-destructed.",
    lastTime: "01:07",
    unread: 0,
    verified: false,
    avatar: "VS",
  },
  {
    id: "c5",
    handle: "SECTOR_9",
    key: "0xB88F...0E22",
    status: "ONLINE",
    lastMsg: "Key rotation complete. New fingerprint attached.",
    lastTime: "00:49",
    unread: 3,
    verified: true,
    avatar: "S9",
  },
];

type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
  encrypted: boolean;
  destroyed?: boolean;
  verified?: boolean;
};

const THREAD: Record<string, Message[]> = {
  c1: [
    { id: "m1", from: "them", text: "SECURE CHANNEL ESTABLISHED. E2E-256 active.", time: "03:41", encrypted: true, verified: true },
    { id: "m2", from: "me", text: "Confirmed. Standing by for coordinates.", time: "03:42", encrypted: true },
    { id: "m3", from: "them", text: "Packet routed via TOR circuit 7. TTL 300s.", time: "03:55", encrypted: true, verified: true },
    { id: "m4", from: "me", text: "Acknowledged. Relay is clean.", time: "03:56", encrypted: true },
    { id: "m5", from: "them", text: "Exfil window closes at 0400. Confirm receipt.", time: "04:11", encrypted: true, verified: true },
    { id: "m6", from: "them", text: "[MESSAGE SELF-DESTRUCTED]", time: "04:12", encrypted: true, destroyed: true },
  ],
  c2: [
    { id: "m1", from: "them", text: "New signing cert pushed to keyring.", time: "03:58", encrypted: true, verified: true },
    { id: "m2", from: "me", text: "Fingerprint verified. Trust level elevated.", time: "03:59", encrypted: true },
  ],
  c3: [
    { id: "m1", from: "them", text: "████████████ [DECRYPTED]", time: "02:34", encrypted: true, verified: true },
  ],
  c4: [
    { id: "m1", from: "them", text: "Message self-destructed.", time: "01:07", encrypted: true, destroyed: true },
  ],
  c5: [
    { id: "m1", from: "them", text: "Key rotation complete. New fingerprint attached.", time: "00:49", encrypted: true, verified: true },
    { id: "m2", from: "me", text: "Updating local keychain now.", time: "00:50", encrypted: true },
    { id: "m3", from: "them", text: "Standby for auth token.", time: "00:51", encrypted: true, verified: true },
  ],
};

// ─── Util ─────────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const c = status === "ONLINE" ? "bg-[#00ff41]" : status === "AWAY" ? "bg-white/50" : "bg-white/15";
  return <div className={`w-1.5 h-1.5 rounded-full ${c} ${status === "ONLINE" ? "pulse-dot" : ""}`} />;
}

function LockIcon({ size = 3 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-${size} h-${size}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function ConversationList({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = CONTACTS.filter((c) =>
    c.handle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[8px] text-white/25 tracking-[0.35em] mb-0.5">SECURE MESSENGER</div>
            <div className="font-display text-lg tracking-[0.18em] text-white white-glow">VAULTEX·MSG</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-dot" />
            <span className="font-mono text-[8px] text-[#00ff41] tracking-widest green-glow">E2E ACTIVE</span>
          </div>
        </div>

        {/* Search */}
        <div className="border border-white/15 flex items-center gap-2 px-3 py-2">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/20 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH HANDLES..."
            className="bg-transparent font-mono text-[10px] text-white/60 placeholder-white/15 tracking-widest outline-none flex-1"
          />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-b border-white/10">
        {[
          { label: "CONTACTS", val: CONTACTS.length },
          { label: "ONLINE", val: CONTACTS.filter((c) => c.status === "ONLINE").length },
          { label: "UNREAD", val: CONTACTS.reduce((a, c) => a + c.unread, 0) },
        ].map((s) => (
          <div key={s.label} className="text-center py-2 border-r border-white/10 last:border-0">
            <div className="font-display text-sm text-white">{s.val}</div>
            <div className="font-mono text-[7px] text-white/20 tracking-widest">{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full text-left border-b border-white/[0.06] px-4 py-3 hover:bg-white/[0.03] transition-colors flex items-center gap-3"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 border border-white/20 flex items-center justify-center bg-white/[0.04]">
                <span className="font-display text-[10px] text-white/50 tracking-wider">{c.avatar}</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={c.status} />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-[11px] text-white/80 tracking-wide truncate">{c.handle}</span>
                {c.verified && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#00ff41] shrink-0" fill="currentColor">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.491 4.491 0 01-3.497-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="font-mono text-[8px] text-white/25 tracking-widest truncate">{c.lastMsg}</div>
              <div className="font-mono text-[7px] text-white/15 tracking-widest mt-1">{c.key}</div>
            </div>

            {/* Meta */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="font-mono text-[8px] text-white/20">{c.lastTime}</span>
              {c.unread > 0 && (
                <div className="w-4 h-4 bg-white flex items-center justify-center">
                  <span className="font-display text-[8px] text-black">{c.unread}</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="text-white/20">
          <LockIcon size={4} />
        </div>
        <div className="flex-1">
          <div className="font-mono text-[8px] text-white/20 tracking-widest">ALL MESSAGES END-TO-END ENCRYPTED</div>
          <div className="font-mono text-[7px] text-white/10 tracking-widest">X25519 · ChaCha20-Poly1305 · BLAKE3</div>
        </div>
        <button className="border border-white/15 p-2 hover:bg-white/5 transition-colors">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ChatScreen({
  contactId,
  onBack,
}: {
  contactId: string;
  onBack: () => void;
}) {
  const contact = CONTACTS.find((c) => c.id === contactId)!;
  const [messages, setMessages] = useState<Message[]>(THREAD[contactId] || []);
  const [input, setInput] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMessages((prev) => [
      ...prev,
      { id: `m${Date.now()}`, from: "me", text, time, encrypted: true },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-white/10 px-3 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white/30 hover:text-white/60 transition-colors p-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="relative shrink-0">
          <div className="w-8 h-8 border border-white/20 flex items-center justify-center bg-white/[0.04]">
            <span className="font-display text-[9px] text-white/50">{contact.avatar}</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5">
            <StatusDot status={contact.status} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-white/80 tracking-wide">{contact.handle}</span>
            {contact.verified && (
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#00ff41]" fill="currentColor">
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.491 4.491 0 01-3.497-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="font-mono text-[7px] text-white/20 tracking-widest">{contact.key}</div>
        </div>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`border p-2 transition-colors ${showInfo ? "border-white/40 text-white/60" : "border-white/10 text-white/20 hover:text-white/40"}`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
      </div>

      {/* Security info panel */}
      {showInfo && (
        <div className="border-b border-white/10 px-4 py-3 bg-white/[0.02] space-y-2 animate-fade-up">
          <div className="font-mono text-[8px] text-white/30 tracking-widest mb-2">SESSION SECURITY</div>
          {[
            { label: "CIPHER", val: "ChaCha20-Poly1305" },
            { label: "KEY EXCHANGE", val: "X25519 ECDH" },
            { label: "HASH", val: "BLAKE3-256" },
            { label: "FORWARD SECRECY", val: "ENABLED" },
            { label: "FINGERPRINT", val: contact.key },
          ].map((r) => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="font-mono text-[8px] text-white/20 tracking-widest">{r.label}</span>
              <span className={`font-mono text-[8px] ${r.label === "FORWARD SECRECY" ? "text-[#00ff41] green-glow" : "text-white/50"}`}>{r.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Encrypted channel banner */}
      <div className="flex items-center justify-center gap-2 py-2 border-b border-white/[0.06]">
        <div className="text-[#00ff41]/50"><LockIcon size={3} /></div>
        <span className="font-mono text-[7px] text-white/20 tracking-widest">CHANNEL ENCRYPTED · MESSAGES AUTO-DELETE AFTER 24H</span>
        <div className="text-[#00ff41]/50"><LockIcon size={3} /></div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
          >
            {msg.destroyed ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-white/[0.08]">
                <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/15" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
                <span className="font-mono text-[8px] text-white/20 tracking-widest italic">{msg.text}</span>
              </div>
            ) : (
              <div
                className={`max-w-[78%] ${
                  msg.from === "me"
                    ? "bg-white text-black"
                    : "bg-white/[0.05] border border-white/10 text-white/70"
                }`}
              >
                <div className="px-3 pt-2 pb-1.5">
                  <p className={`font-mono text-[10px] leading-relaxed ${msg.from === "me" ? "text-black" : "text-white/70"}`}>
                    {msg.text}
                  </p>
                </div>
                <div className={`px-3 pb-2 flex items-center gap-1.5 ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                  <span className={`font-mono text-[7px] ${msg.from === "me" ? "text-black/40" : "text-white/20"}`}>{msg.time}</span>
                  {msg.encrypted && (
                    <span className={`font-mono text-[7px] ${msg.from === "me" ? "text-black/30" : "text-white/15"}`}>
                      <LockIcon size={2} />
                    </span>
                  )}
                  {msg.verified && msg.from === "them" && (
                    <svg viewBox="0 0 24 24" className="w-2 h-2 text-[#00ff41]/60" fill="currentColor">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 px-3 py-3 flex items-center gap-2">
        <div className="flex-1 border border-white/15 flex items-center gap-2 px-3 py-2">
          <div className="text-[#00ff41]/40 shrink-0"><LockIcon size={3} /></div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="ENCRYPTED MESSAGE..."
            className="bg-transparent font-mono text-[10px] text-white/60 placeholder-white/15 tracking-widest outline-none flex-1"
          />
        </div>

        {/* Self-destruct toggle */}
        <button className="border border-white/10 p-2 text-white/20 hover:text-white/40 transition-colors">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
        </button>

        <button
          onClick={send}
          disabled={!input.trim()}
          className="border border-white/20 p-2 text-white/40 hover:text-white/80 hover:border-white/40 disabled:opacity-20 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>

      {/* Cipher footer */}
      <div className="border-t border-white/[0.06] px-4 py-1.5">
        <div className="font-mono text-[7px] text-white/10 tracking-widest text-center cursor-blink">
          X25519 · ChaCha20-Poly1305 · BLAKE3 · PFS ENABLED
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeContact, setActiveContact] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-[#050505] flex items-center justify-center p-4">
      {/* Phone frame */}
      <div
        className="w-full max-w-[390px] bg-black border border-white/12 flex flex-col relative overflow-hidden"
        style={{ minHeight: 780, height: "min(780px, 90vh)" }}
      >
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)",
          }}
        />

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.07] z-10 shrink-0">
          <div className="font-mono text-[7px] text-white/20 tracking-[0.3em]">VAULTEX·MSG</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-[#00ff41]" />
              <span className="font-mono text-[7px] text-[#00ff41]/70 tracking-widest">E2E-256</span>
            </div>
            <div className="font-mono text-[7px] text-white/20 tracking-widest">████</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden z-10">
          {activeContact ? (
            <div className="h-full flex flex-col">
              <ChatScreen
                contactId={activeContact}
                onBack={() => setActiveContact(null)}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <ConversationList onSelect={setActiveContact} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
