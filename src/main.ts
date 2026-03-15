import { useState, useEffect, useRef, useCallback } from "react";
import {
  Youtube, Settings, LogOut, RefreshCw, MessageSquare, Bot,
  Send, X, ChevronDown, ChevronUp, Search, CheckSquare, Square,
  Sparkles, Pencil, ThumbsUp, Reply, Filter, SortAsc, Clock,
  Layers, Zap, Check, AlertCircle, Info, Bell, User, PlaySquare,
  MoreVertical, Loader2, ChevronRight, Hash, HelpCircle, Star,
  LayoutList, Inbox
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  if (secs < 31536000) return `${Math.floor(secs / 2592000)}mo ago`;
  return `${Math.floor(secs / 31536000)}y ago`;
}

function escHtml(str = "") {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, push };
}

function ToastContainer({ toasts }) {
  const icons = { success: <Check size={15} />, error: <AlertCircle size={15} />, warning: <Bell size={15} />, info: <Info size={15} /> };
  const colors = { success: "#22c55e", error: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, width: "calc(100% - 32px)", maxWidth: 400 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: "#1e1e2e", border: `1px solid ${colors[t.type]}40`, borderLeft: `3px solid ${colors[t.type]}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: 13, boxShadow: "0 8px 32px rgba(0,0,0,.5)", animation: "slideUp .25s ease" }}>
          <span style={{ color: colors[t.type] }}>{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── YouTube OAuth helpers ────────────────────────────────────────────────────
function getOAuthUrl(clientId) {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");
  let redirectUri = window.location.origin + window.location.pathname;
  if (redirectUri.endsWith("/")) redirectUri = redirectUri.slice(0, -1);
  const p = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope: scopes, include_granted_scopes: "true" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function ytFetch(endpoint, accessToken, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://www.googleapis.com/youtube/v3${endpoint}`;
  const headers = { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }
  return res.json();
}

// ─── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ open, onClose, settings, onSave, redirectUri }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#13131f", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", padding: "0 0 40px" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px" }}>
          {/* Redirect URI */}
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Authorized Redirect URI</label>
            <div style={{ background: "#0d0d1a", border: "1px solid #2a2a3e", borderRadius: 10, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#a78bfa", wordBreak: "break-all" }}>{redirectUri}</div>
            <p style={hint}>Add this to Google Cloud Console → Authorized Redirect URIs</p>
          </div>
          {[
            { id: "apiKey", label: "YouTube API Key", placeholder: "AIza..." },
            { id: "clientId", label: "OAuth Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
            { id: "groqKey", label: "Groq / OpenRouter API Key", placeholder: "gsk_..." },
          ].map(f => (
            <div key={f.id} style={{ marginBottom: 16 }}>
              <label style={lbl}>{f.label}</label>
              <input type="password" value={form[f.id] || ""} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} placeholder={f.placeholder} style={inp} />
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>AI Model</label>
            <select value={form.groqModel || ""} onChange={e => setForm(p => ({ ...p, groqModel: e.target.value }))} style={inp}>
              {["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>Custom AI Instructions (Optional)</label>
            <textarea value={form.customPrompt || ""} onChange={e => setForm(p => ({ ...p, customPrompt: e.target.value }))} rows={3} placeholder="e.g. Always mention my channel name..." style={{ ...inp, resize: "vertical" }} />
          </div>
          <button onClick={() => onSave(form)} style={primaryBtn}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const lbl = { display: "block", color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 };
const hint = { color: "#4b5563", fontSize: 11, marginTop: 4 };
const inp = { width: "100%", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };

// ─── Comment Card ────────────────────────────────────────────────────────────
function CommentCard({ comment, onAiReply, onPost, videoTitle }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleAiGen = async () => {
    setGenerating(true);
    setReplyOpen(true);
    const text = await onAiReply(comment, videoTitle);
    if (text) setDraft(text);
    setGenerating(false);
  };

  return (
    <div style={{
      background: "#13131f",
      border: `1px solid ${comment.hasOwnerReply ? "#16a34a40" : "#1e1e2e"}`,
      borderRadius: 16,
      padding: "14px 14px 0",
      marginBottom: 10,
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img src={comment.authorAvatar} alt="" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "#1e1e2e" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{comment.authorName}</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {comment.hasOwnerReply
                ? <span style={{ background: "#16a34a20", color: "#4ade80", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #16a34a40" }}>Replied</span>
                : <span style={{ background: "#92400e20", color: "#fbbf24", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #92400e40" }}>Unreplied</span>}
              {comment.textOriginal?.includes("?") && <span style={{ background: "#1d4ed820", color: "#60a5fa", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #1d4ed840" }}>?</span>}
            </div>
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={10} />
            {timeAgo(comment.publishedAt)}
            {comment.videoTitle && <><span style={{ color: "#333" }}>·</span><span style={{ color: "#7c3aed", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comment.videoTitle}</span></>}
          </div>
        </div>
      </div>

      {/* Body */}
      <p style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.6, margin: "10px 0 8px", paddingLeft: 46 }}
        dangerouslySetInnerHTML={{ __html: comment.text }} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, paddingLeft: 46, marginBottom: 10 }}>
        <span style={{ color: "#4b5563", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={12} />{comment.likeCount}</span>
        <span style={{ color: "#4b5563", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><MessageSquare size={12} />{comment.replyCount}</span>
      </div>

      {/* Actions */}
      {!comment.hasOwnerReply && (
        <div style={{ display: "flex", gap: 8, padding: "10px 0", borderTop: "1px solid #1a1a2e" }}>
          <button onClick={handleAiGen} disabled={generating} style={{ flex: 1, background: generating ? "#1e1e2e" : "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none", borderRadius: 10, padding: "9px 0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {generating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={14} /> AI Reply</>}
          </button>
          <button onClick={() => setReplyOpen(o => !o)} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 10, padding: "9px 0", color: "#9ca3af", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Pencil size={14} /> Write
          </button>
        </div>
      )}

      {/* Existing reply view */}
      {comment.hasOwnerReply && (
        <div>
          <button onClick={() => setReplyOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", padding: "10px 0", color: "#4ade80", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #1a1a2e" }}>
            <Reply size={13} /> {replyOpen ? "Hide reply" : "View your reply"}
            {replyOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {replyOpen && (
            <div style={{ background: "#0d0d1a", borderRadius: 10, padding: "12px", marginBottom: 12, borderLeft: "3px solid #4ade80" }}>
              <p style={{ color: "#d1d5db", fontSize: 13, margin: 0 }}>{comment.ownerReplyText}</p>
            </div>
          )}
        </div>
      )}

      {/* Reply box */}
      {replyOpen && !comment.hasOwnerReply && (
        <div style={{ padding: "0 0 12px" }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Type your reply..."
            rows={3}
            style={{ ...inp, marginBottom: 8, resize: "vertical", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setReplyOpen(false); setDraft(""); }} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 10, padding: "9px 0", color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAiGen} disabled={generating} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #7c3aed40", borderRadius: 10, padding: "9px 0", color: "#a78bfa", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {generating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />} Regenerate
            </button>
            <button onClick={() => onPost(comment.commentId, draft)} disabled={!draft.trim()} style={{ flex: 1, background: draft.trim() ? "linear-gradient(135deg,#16a34a,#15803d)" : "#1a1a2e", border: "none", borderRadius: 10, padding: "9px 0", color: draft.trim() ? "#fff" : "#4b5563", fontSize: 13, fontWeight: 700, cursor: draft.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Send size={13} /> Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  // Persisted settings
  const [settings, setSettings] = useState(() => ({
    apiKey: localStorage.getItem("yt_api_key") || "",
    clientId: localStorage.getItem("yt_client_id") || "",
    groqKey: localStorage.getItem("groq_key") || "",
    groqModel: localStorage.getItem("groq_model") || "openai/gpt-oss-20b",
    customPrompt: localStorage.getItem("custom_prompt") || "",
  }));

  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("yt_access_token") || "");
  const [channel, setChannel] = useState(() => ({
    id: localStorage.getItem("yt_channel_id") || "",
    title: localStorage.getItem("yt_channel_title") || "",
    avatar: localStorage.getItem("yt_channel_avatar") || "",
  }));

  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [allComments, setAllComments] = useState([]); // all comments across videos with videoTitle
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTone, setReplyTone] = useState(() => localStorage.getItem("reply_tone") || "friendly");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "videos"
  const { toasts, push: toast } = useToast();

  const redirectUri = (window.location.origin + window.location.pathname).replace(/\/$/, "");

  // ── OAuth callback ──────────────────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const p = new URLSearchParams(hash.substring(1));
      const token = p.get("access_token");
      if (token) {
        setAccessToken(token);
        localStorage.setItem("yt_access_token", token);
        window.history.replaceState(null, "", window.location.pathname);
        toast("Connected to YouTube!", "success");
      }
    }
  }, []);

  // ── On token + channelId present, load videos ───────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    if (!channel.id) {
      fetchChannelInfo(accessToken);
    } else {
      fetchVideos(accessToken, channel.id);
    }
  }, [accessToken]);

  async function fetchChannelInfo(token) {
    try {
      const data = await ytFetch("/channels?part=snippet&mine=true", token);
      if (data.items?.length) {
        const ch = data.items[0];
        const c = { id: ch.id, title: ch.snippet.title, avatar: ch.snippet.thumbnails?.default?.url || "" };
        setChannel(c);
        localStorage.setItem("yt_channel_id", c.id);
        localStorage.setItem("yt_channel_title", c.title);
        localStorage.setItem("yt_channel_avatar", c.avatar);
        fetchVideos(token, c.id);
      }
    } catch (e) { toast("Failed to fetch channel: " + e.message, "error"); }
  }

  async function fetchVideos(token, channelId) {
    setLoadingVideos(true);
    try {
      const data = await ytFetch(`/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=25`, token);
      setVideos(data.items || []);
    } catch (e) { toast("Failed to load videos: " + e.message, "error"); }
    setLoadingVideos(false);
  }

  // ── Load ALL comments across all videos ─────────────────────────────────────
  async function loadAllComments() {
    if (!accessToken || videos.length === 0) return;
    setLoadingComments(true);
    setAllComments([]);
    toast(`Loading comments from ${videos.length} videos...`, "info");

    const result = [];
    for (const v of videos) {
      const videoId = v.id?.videoId;
      if (!videoId) continue;
      try {
        const data = await ytFetch(`/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=50&order=relevance`, accessToken);
        const comments = (data.items || []).map(item => {
          const sn = item.snippet.topLevelComment.snippet;
          const hasOwnerReply = item.replies?.comments?.some(r => r.snippet.authorChannelId?.value === channel.id) || false;
          return {
            id: item.id,
            commentId: item.snippet.topLevelComment.id,
            videoId,
            videoTitle: v.snippet?.title || "Untitled",
            authorName: sn.authorDisplayName,
            authorAvatar: sn.authorProfileImageUrl,
            text: sn.textDisplay,
            textOriginal: sn.textOriginal,
            publishedAt: sn.publishedAt,
            likeCount: sn.likeCount || 0,
            replyCount: item.snippet.totalReplyCount || 0,
            hasOwnerReply,
            ownerReplyText: hasOwnerReply ? item.replies.comments.find(r => r.snippet.authorChannelId?.value === channel.id)?.snippet.textOriginal || "" : "",
          };
        });
        result.push(...comments);
      } catch (_) { /* skip video if error */ }
    }

    // Sort by time (newest first)
    result.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    setAllComments(result);
    setLoadingComments(false);
    toast(`Loaded ${result.length} comments from ${videos.length} videos`, "success");
  }

  // Auto-load comments when videos tab changes
  useEffect(() => {
    if (accessToken && videos.length > 0 && allComments.length === 0) {
      loadAllComments();
    }
  }, [videos]);

  // ── Fetch single video comments ─────────────────────────────────────────────
  async function fetchVideoComments(videoId) {
    if (!accessToken) return;
    setLoadingComments(true);
    try {
      const data = await ytFetch(`/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=50&order=relevance`, accessToken);
      const comments = (data.items || []).map(item => {
        const sn = item.snippet.topLevelComment.snippet;
        const hasOwnerReply = item.replies?.comments?.some(r => r.snippet.authorChannelId?.value === channel.id) || false;
        const vData = videos.find(v => v.id?.videoId === videoId);
        return {
          id: item.id,
          commentId: item.snippet.topLevelComment.id,
          videoId,
          videoTitle: vData?.snippet?.title || "",
          authorName: sn.authorDisplayName,
          authorAvatar: sn.authorProfileImageUrl,
          text: sn.textDisplay,
          textOriginal: sn.textOriginal,
          publishedAt: sn.publishedAt,
          likeCount: sn.likeCount || 0,
          replyCount: item.snippet.totalReplyCount || 0,
          hasOwnerReply,
          ownerReplyText: hasOwnerReply ? item.replies.comments.find(r => r.snippet.authorChannelId?.value === channel.id)?.snippet.textOriginal || "" : "",
        };
      });
      // Merge into allComments (replace for that videoId)
      setAllComments(prev => {
        const others = prev.filter(c => c.videoId !== videoId);
        return [...others, ...comments].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      });
    } catch (e) { toast("Failed to load comments: " + e.message, "error"); }
    setLoadingComments(false);
  }

  // ── AI reply (single) ────────────────────────────────────────────────────────
  async function generateReply(comment, videoTitle) {
    if (!settings.groqKey) { toast("Set Groq API key in Settings", "warning"); return ""; }
    const tones = { friendly: "warm, friendly, appreciative", professional: "professional, polished, respectful", casual: "casual, relaxed, informal", funny: "humorous, witty, lighthearted" };
    const tone = tones[replyTone] || tones.friendly;
    const extra = settings.customPrompt ? `\nExtra: ${settings.customPrompt}` : "";
    const prompt = `You are a YouTuber replying to a comment on your video${videoTitle ? ` "${videoTitle}"` : ""}. Write a ${tone} reply (1-3 sentences, genuine, no hashtags).${extra}\n\nComment: "${comment.textOriginal}"`;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.groqKey}` },
        body: JSON.stringify({ model: settings.groqModel, messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 150 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || "Groq error");
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) { toast("AI error: " + e.message, "error"); return ""; }
  }

  // ── Batch AI generate ALL selected as single JSON call ───────────────────────
  async function batchGenerateAll() {
    const unreplied = [...selectedIds].filter(id => {
      const c = allComments.find(cm => cm.commentId === id);
      return c && !c.hasOwnerReply;
    });
    if (unreplied.length === 0) { toast("No unreplied comments selected", "info"); return; }
    if (!settings.groqKey) { toast("Set Groq API key in Settings", "warning"); return; }

    setBatchGenerating(true);
    toast(`Generating ${unreplied.length} replies in batch...`, "info");

    // Build single JSON payload with all comments
    const tones = { friendly: "warm, friendly, appreciative", professional: "professional, polished, respectful", casual: "casual, relaxed, informal", funny: "humorous, witty, lighthearted" };
    const tone = tones[replyTone] || tones.friendly;
    const extra = settings.customPrompt ? `\nExtra instructions: ${settings.customPrompt}` : "";

    const commentsForAI = unreplied.map(id => {
      const c = allComments.find(cm => cm.commentId === id);
      return { id: c.commentId, videoTitle: c.videoTitle || "", comment: c.textOriginal };
    });

    const prompt = `You are a YouTuber. Reply to each comment with a ${tone} response (1-3 sentences, no hashtags, genuine).${extra}

Return ONLY a valid JSON array like: [{"id":"<comment_id>","reply":"<your reply>"},...]

Comments JSON:
${JSON.stringify(commentsForAI, null, 2)}`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.groqKey}` },
        body: JSON.stringify({ model: settings.groqModel, messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 2000 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || "Groq error");
      const data = await res.json();
      let raw = data.choices?.[0]?.message?.content?.trim() || "[]";
      raw = raw.replace(/```json|```/g, "").trim();
      const replies = JSON.parse(raw);

      // Post all replies
      let posted = 0;
      for (const r of replies) {
        if (!r.id || !r.reply) continue;
        try {
          await ytFetch("/comments?part=snippet", accessToken, {
            method: "POST",
            body: JSON.stringify({ snippet: { parentId: r.id, textOriginal: r.reply } }),
          });
          setAllComments(prev => prev.map(c => c.commentId === r.id ? { ...c, hasOwnerReply: true, ownerReplyText: r.reply, replyCount: c.replyCount + 1 } : c));
          posted++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (_) {}
      }
      toast(`Batch done! Posted ${posted}/${replies.length} replies.`, "success");
    } catch (e) { toast("Batch error: " + e.message, "error"); }

    setSelectedIds(new Set());
    setBatchGenerating(false);
  }

  // ── Post single reply ────────────────────────────────────────────────────────
  async function postReply(commentId, text) {
    try {
      await ytFetch("/comments?part=snippet", accessToken, {
        method: "POST",
        body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: text } }),
      });
      setAllComments(prev => prev.map(c => c.commentId === commentId ? { ...c, hasOwnerReply: true, ownerReplyText: text, replyCount: c.replyCount + 1 } : c));
      toast("Reply posted!", "success");
    } catch (e) { toast("Failed to post: " + e.message, "error"); }
  }

  // ── Save settings ────────────────────────────────────────────────────────────
  function saveSettings(form) {
    setSettings(form);
    Object.entries({ yt_api_key: form.apiKey, yt_client_id: form.clientId, groq_key: form.groqKey, groq_model: form.groqModel, custom_prompt: form.customPrompt }).forEach(([k, v]) => localStorage.setItem(k, v));
    setSettingsOpen(false);
    toast("Settings saved!", "success");
  }

  function logout() {
    setAccessToken("");
    setChannel({ id: "", title: "", avatar: "" });
    setVideos([]);
    setAllComments([]);
    setSelectedVideoId("");
    ["yt_access_token", "yt_channel_id", "yt_channel_title", "yt_channel_avatar"].forEach(k => localStorage.removeItem(k));
    toast("Disconnected", "info");
  }

  // ── Filtering ────────────────────────────────────────────────────────────────
  const displayComments = (() => {
    let list = selectedVideoId ? allComments.filter(c => c.videoId === selectedVideoId) : allComments;
    if (filter === "unreplied") list = list.filter(c => !c.hasOwnerReply);
    if (filter === "replied") list = list.filter(c => c.hasOwnerReply);
    if (filter === "questions") list = list.filter(c => c.textOriginal?.includes("?"));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.textOriginal?.toLowerCase().includes(q) || c.authorName?.toLowerCase().includes(q));
    }
    if (sortBy === "oldest") list = [...list].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    else if (sortBy === "likes") list = [...list].sort((a, b) => b.likeCount - a.likeCount);
    else if (sortBy === "replies") list = [...list].sort((a, b) => b.replyCount - a.replyCount);
    else list = [...list].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return list;
  })();

  const isLoggedIn = !!accessToken && !!channel.id;
  const stats = {
    total: allComments.length,
    unreplied: allComments.filter(c => !c.hasOwnerReply).length,
    replied: allComments.filter(c => c.hasOwnerReply).length,
    questions: allComments.filter(c => c.textOriginal?.includes("?")).length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0a0a14", minHeight: "100vh", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 430, margin: "0 auto", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a14; }
        ::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
        input:focus, textarea:focus, select:focus { outline: 2px solid #7c3aed !important; border-color: #7c3aed !important; }
      `}</style>

      {/* ── Status Bar ── */}
      <div style={{ background: "#0d0d1a", padding: "10px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid #1a1a2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#7c3aed,#dc2626)", borderRadius: 10, padding: "5px 7px" }}>
            <Youtube size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-.02em" }}>YT Reply AI</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isLoggedIn && (
            <>
              {channel.avatar && <img src={channel.avatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #7c3aed" }} />}
              <button onClick={() => fetchVideos(accessToken, channel.id)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
                <RefreshCw size={16} />
              </button>
              <button onClick={logout} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
                <LogOut size={16} />
              </button>
            </>
          )}
          <button onClick={() => setSettingsOpen(true)} style={{ background: "#1a1a2e", border: "none", color: "#9ca3af", cursor: "pointer", padding: 6, borderRadius: 8 }}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {!isLoggedIn ? (
        // Welcome screen
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, background: "linear-gradient(135deg,#7c3aed20,#dc262620)", borderRadius: 24, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #7c3aed30" }}>
            <Bot size={36} color="#a78bfa" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10, letterSpacing: "-.03em" }}>YouTube Reply AI</h1>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, marginBottom: 30 }}>
            Manage and auto-reply to all your YouTube comments with AI — batch replies in a single click.
          </p>

          {settings.clientId ? (
            <button onClick={() => window.location.href = getOAuthUrl(settings.clientId)} style={{ ...primaryBtn, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
              <Youtube size={18} /> Connect YouTube Account
            </button>
          ) : (
            <button onClick={() => setSettingsOpen(true)} style={{ ...primaryBtn, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Settings size={18} /> Set Up API Keys
            </button>
          )}

          <div style={{ background: "#0d0d1a", border: "1px solid #1e1e2e", borderRadius: 14, padding: "14px", textAlign: "left", marginBottom: 24 }}>
            <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>Authorized Redirect URI:</p>
            <code style={{ color: "#a78bfa", fontSize: 11, wordBreak: "break-all" }}>{redirectUri}</code>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[["⚙️", "API Keys", "Configure YouTube + Groq keys"], ["🔗", "Connect", "Sign in with YouTube OAuth"], ["🤖", "Auto Reply", "Batch AI replies instantly"]].map(([icon, t, d]) => (
              <div key={t} style={{ background: "#0d0d1a", border: "1px solid #1e1e2e", borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{t}</div>
                <div style={{ color: "#4b5563", fontSize: 11 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {/* ── Stats Strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "12px 12px 0" }}>
            {[["Total", stats.total, "#a78bfa"], ["Unreplied", stats.unreplied, "#fbbf24"], ["Replied", stats.replied, "#4ade80"], ["Questions", stats.questions, "#60a5fa"]].map(([label, val, color]) => (
              <div key={label} style={{ background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ color, fontSize: 20, fontWeight: 800 }}>{val}</div>
                <div style={{ color: "#4b5563", fontSize: 10, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: "flex", padding: "12px 12px 0", gap: 8 }}>
            {[["all", <Inbox size={14} />, "All Comments"], ["videos", <PlaySquare size={14} />, "Videos"]].map(([id, icon, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, background: activeTab === id ? "#1a1a2e" : "none", border: activeTab === id ? "1px solid #2a2a3e" : "1px solid transparent", borderRadius: 10, padding: "9px 0", color: activeTab === id ? "#a78bfa" : "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {icon}{label}
              </button>
            ))}
          </div>

          {activeTab === "videos" ? (
            // ── Videos Tab ──
            <div style={{ padding: "12px" }}>
              {loadingVideos ? (
                <div style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>
                  <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
                  <p>Loading videos...</p>
                </div>
              ) : videos.map(v => {
                const videoId = v.id?.videoId;
                const isActive = videoId === selectedVideoId;
                const vComments = allComments.filter(c => c.videoId === videoId);
                return (
                  <div key={videoId} onClick={() => { setSelectedVideoId(isActive ? "" : videoId); setActiveTab("all"); }} style={{ background: "#0d0d1a", border: `1px solid ${isActive ? "#7c3aed60" : "#1a1a2e"}`, borderRadius: 14, padding: "12px", marginBottom: 10, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                    <img src={v.snippet?.thumbnails?.default?.url} alt="" style={{ width: 64, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#1a1a2e" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.snippet?.title}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <span style={{ color: "#4b5563", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} />{timeAgo(v.snippet?.publishedAt)}</span>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{vComments.length} comments</span>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#4b5563" style={{ flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          ) : (
            // ── All Comments Tab ──
            <div style={{ padding: "12px" }}>
              {/* Filter/sort row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4b5563" }} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search comments..." style={{ ...inp, paddingLeft: 32, fontSize: 13 }} />
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inp, width: "auto", minWidth: 90, fontSize: 12, padding: "0 10px" }}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="likes">Top Liked</option>
                  <option value="replies">Most Replies</option>
                </select>
              </div>

              {/* Filter pills */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
                {[["all", "All"], ["unreplied", "Unreplied"], ["replied", "Replied"], ["questions", "Questions?"]].map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{ background: filter === id ? "#7c3aed" : "#1a1a2e", border: `1px solid ${filter === id ? "#7c3aed" : "#2a2a3e"}`, borderRadius: 20, padding: "6px 14px", color: filter === id ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{label}</button>
                ))}
              </div>

              {/* Tone pills */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                <span style={{ color: "#4b5563", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", flexShrink: 0 }}>Tone:</span>
                {[["friendly", "😊"], ["professional", "💼"], ["casual", "😎"], ["funny", "😂"]].map(([id, emoji]) => (
                  <button key={id} onClick={() => { setReplyTone(id); localStorage.setItem("reply_tone", id); }} style={{ background: replyTone === id ? "#1a1a2e" : "none", border: `1px solid ${replyTone === id ? "#7c3aed" : "#2a2a3e"}`, borderRadius: 20, padding: "5px 12px", color: replyTone === id ? "#a78bfa" : "#6b7280", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>{emoji} {id}</button>
                ))}
              </div>

              {/* Video filter badge */}
              {selectedVideoId && (
                <div style={{ background: "#1a1a2e", border: "1px solid #7c3aed40", borderRadius: 10, padding: "8px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a78bfa", fontSize: 12 }}>Filtered: {videos.find(v => v.id?.videoId === selectedVideoId)?.snippet?.title?.slice(0, 40)}...</span>
                  <button onClick={() => setSelectedVideoId("")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={14} /></button>
                </div>
              )}

              {/* Reload all button */}
              <button onClick={loadAllComments} disabled={loadingComments} style={{ width: "100%", background: "#0d0d1a", border: "1px dashed #2a2a3e", borderRadius: 10, padding: "9px", color: loadingComments ? "#4b5563" : "#7c3aed", fontSize: 12, cursor: loadingComments ? "not-allowed" : "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {loadingComments ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Loading all comments...</> : <><RefreshCw size={13} /> Reload all comments from all videos</>}
              </button>

              {/* Select all + count */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button onClick={() => {
                  if (selectedIds.size === displayComments.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(displayComments.map(c => c.commentId)));
                }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedIds.size === displayComments.length && displayComments.length > 0 ? <CheckSquare size={15} color="#7c3aed" /> : <Square size={15} />}
                  Select all ({displayComments.length})
                </button>
                <span style={{ color: "#4b5563", fontSize: 11 }}>Serial: newest first</span>
              </div>

              {/* Comment list */}
              {loadingComments ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
                  <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
                  <p style={{ fontSize: 13 }}>Loading comments...</p>
                </div>
              ) : displayComments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
                  <MessageSquare size={36} style={{ marginBottom: 10, opacity: .4 }} />
                  <p style={{ fontSize: 14 }}>No comments found</p>
                </div>
              ) : (
                displayComments.map((c, i) => (
                  <div key={c.commentId} style={{ position: "relative" }}>
                    {/* Serial number + checkbox overlay */}
                    <div style={{ position: "absolute", top: 14, left: 14, zIndex: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setSelectedIds(prev => {
                        const n = new Set(prev);
                        n.has(c.commentId) ? n.delete(c.commentId) : n.add(c.commentId);
                        return n;
                      })} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {selectedIds.has(c.commentId) ? <CheckSquare size={16} color="#7c3aed" /> : <Square size={16} color="#4b5563" />}
                      </button>
                      <span style={{ color: "#4b5563", fontSize: 10, fontWeight: 700 }}>#{i + 1}</span>
                    </div>
                    <div style={{ paddingLeft: 48 }}>
                      <CommentCard
                        comment={c}
                        onAiReply={generateReply}
                        onPost={postReply}
                        videoTitle={c.videoTitle}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Batch Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#13131f", borderTop: "1px solid #1e1e2e", padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", zIndex: 100 }}>
          <span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, flex: 1 }}>{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())} style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 10, padding: "9px 14px", color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>Clear</button>
          <button onClick={batchGenerateAll} disabled={batchGenerating} style={{ background: batchGenerating ? "#2a2a3e" : "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none", borderRadius: 10, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: batchGenerating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {batchGenerating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Zap size={14} /> AI Reply All (JSON)</>}
          </button>
        </div>
      )}

      {/* ── Settings Modal ── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={saveSettings} redirectUri={redirectUri} />

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
