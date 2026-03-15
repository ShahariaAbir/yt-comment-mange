// =========================================
// YT Comment Manager — Main Application
// =========================================
import './style.css';

// =========================================
// State
// =========================================
interface AppState {
  apiKey: string;
  clientId: string;
  geminiKey: string;
  accessToken: string;
  channelId: string;
  channelTitle: string;
  channelAvatar: string;
  videos: any[];
  selectedVideoId: string;
  comments: any[];
  selectedComments: Set<string>;
  filter: string;       // 'all' | 'unreplied' | 'replied' | 'questions'
  sortBy: string;       // 'newest' | 'oldest' | 'likes' | 'replies'
  searchQuery: string;
  nextPageToken: string;
  isLoadingVideos: boolean;
  isLoadingComments: boolean;
  replyTone: string;    // 'friendly' | 'professional' | 'casual' | 'funny'
  customPrompt: string;
  generatingReplies: Set<string>;
  replyDrafts: Map<string, string>;
  openReplyAreas: Set<string>;
}

const state: AppState = {
  apiKey: localStorage.getItem('yt_api_key') || '',
  clientId: localStorage.getItem('yt_client_id') || '',
  geminiKey: localStorage.getItem('gemini_key') || '',
  accessToken: localStorage.getItem('yt_access_token') || '',
  channelId: localStorage.getItem('yt_channel_id') || '',
  channelTitle: localStorage.getItem('yt_channel_title') || '',
  channelAvatar: localStorage.getItem('yt_channel_avatar') || '',
  videos: [],
  selectedVideoId: '',
  comments: [],
  selectedComments: new Set(),
  filter: 'all',
  sortBy: 'newest',
  searchQuery: '',
  nextPageToken: '',
  isLoadingVideos: false,
  isLoadingComments: false,
  replyTone: localStorage.getItem('reply_tone') || 'friendly',
  customPrompt: localStorage.getItem('custom_prompt') || '',
  generatingReplies: new Set(),
  replyDrafts: new Map(),
  openReplyAreas: new Set(),
};

// =========================================
// Toast System
// =========================================
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons: Record<string, string> = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =========================================
// YouTube OAuth 2.0
// =========================================
function getOAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly',
  ];
  
  // Clean redirect URI: remove trailing slash if path is just /
  let redirectUri = window.location.origin + window.location.pathname;
  if (redirectUri.endsWith('/') && window.location.pathname === '/') {
    redirectUri = redirectUri.slice(0, -1);
  }

  const params = new URLSearchParams({
    client_id: state.clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopes.join(' '),
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function handleOAuthCallback() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      state.accessToken = token;
      localStorage.setItem('yt_access_token', token);
      window.history.replaceState(null, '', window.location.pathname);
      showToast('Successfully connected to YouTube!', 'success');
      fetchChannelInfo();
    }
  }
}

// =========================================
// YouTube API Helpers
// =========================================
async function ytApiFetch(endpoint: string, options: RequestInit = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com/youtube/v3${endpoint}`;
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (state.accessToken) {
    headers['Authorization'] = `Bearer ${state.accessToken}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    state.accessToken = '';
    localStorage.removeItem('yt_access_token');
    showToast('Session expired. Please reconnect your YouTube account.', 'warning');
    render();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }
  return res.json();
}

async function fetchChannelInfo() {
  try {
    const data = await ytApiFetch('/channels?part=snippet&mine=true');
    if (data.items?.length) {
      const ch = data.items[0];
      state.channelId = ch.id;
      state.channelTitle = ch.snippet.title;
      state.channelAvatar = ch.snippet.thumbnails?.default?.url || '';
      localStorage.setItem('yt_channel_id', state.channelId);
      localStorage.setItem('yt_channel_title', state.channelTitle);
      localStorage.setItem('yt_channel_avatar', state.channelAvatar);
      render();
      fetchVideos();
    }
  } catch (e: any) {
    showToast('Failed to fetch channel info: ' + e.message, 'error');
  }
}

async function fetchVideos() {
  if (state.isLoadingVideos) return;
  state.isLoadingVideos = true;
  render();
  try {
    const data = await ytApiFetch(
      `/search?part=snippet&channelId=${state.channelId}&type=video&order=date&maxResults=25`
    );
    state.videos = data.items || [];
    state.isLoadingVideos = false;
    render();
  } catch (e: any) {
    state.isLoadingVideos = false;
    showToast('Failed to load videos: ' + e.message, 'error');
    render();
  }
}

async function fetchComments(videoId: string, pageToken?: string) {
  state.isLoadingComments = true;
  if (!pageToken) {
    state.comments = [];
    state.selectedComments = new Set();
  }
  render();
  try {
    let url = `/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=50&order=relevance`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const data = await ytApiFetch(url);
    const newComments = (data.items || []).map((item: any) => {
      const snippet = item.snippet.topLevelComment.snippet;
      const hasOwnerReply = item.replies?.comments?.some(
        (r: any) => r.snippet.authorChannelId?.value === state.channelId
      ) || false;
      return {
        id: item.id,
        commentId: item.snippet.topLevelComment.id,
        authorName: snippet.authorDisplayName,
        authorAvatar: snippet.authorProfileImageUrl,
        text: snippet.textDisplay,
        textOriginal: snippet.textOriginal,
        publishedAt: snippet.publishedAt,
        likeCount: snippet.likeCount || 0,
        replyCount: item.snippet.totalReplyCount || 0,
        hasOwnerReply,
        ownerReplyText: hasOwnerReply
          ? item.replies.comments.find(
              (r: any) => r.snippet.authorChannelId?.value === state.channelId
            )?.snippet.textOriginal || ''
          : '',
      };
    });
    state.comments = pageToken ? [...state.comments, ...newComments] : newComments;
    state.nextPageToken = data.nextPageToken || '';
    state.isLoadingComments = false;
    render();
  } catch (e: any) {
    state.isLoadingComments = false;
    showToast('Failed to load comments: ' + e.message, 'error');
    render();
  }
}

async function postReply(commentId: string, text: string) {
  try {
    await ytApiFetch('/comments?part=snippet', {
      method: 'POST',
      body: JSON.stringify({
        snippet: {
          parentId: commentId,
          textOriginal: text,
        },
      }),
    });
    showToast('Reply posted successfully!', 'success');
    // Update local state
    const comment = state.comments.find(c => c.commentId === commentId);
    if (comment) {
      comment.hasOwnerReply = true;
      comment.ownerReplyText = text;
      comment.replyCount += 1;
    }
    state.replyDrafts.delete(commentId);
    state.openReplyAreas.delete(commentId);
    render();
  } catch (e: any) {
    showToast('Failed to post reply: ' + e.message, 'error');
  }
}

// =========================================
// Gemini AI
// =========================================
async function generateReply(commentText: string, videoTitle?: string): Promise<string> {
  if (!state.geminiKey) {
    showToast('Please set your Gemini API key in Settings', 'warning');
    return '';
  }

  const toneDescriptions: Record<string, string> = {
    friendly: 'warm, friendly, and appreciative',
    professional: 'professional, polished, and respectful',
    casual: 'casual, relaxed, natural, using informal language',
    funny: 'humorous, witty, with a fun and lighthearted tone',
  };

  const tone = toneDescriptions[state.replyTone] || toneDescriptions.friendly;
  const customInstructions = state.customPrompt ? `\nAdditional instructions: ${state.customPrompt}` : '';

  const prompt = `You are a YouTuber replying to a comment on your video${videoTitle ? ` titled "${videoTitle}"` : ''}.
Write a ${tone} reply to this YouTube comment. Keep it concise (1-3 sentences). Be genuine and engaging. Do not use hashtags. Reply as if you are the creator.${customInstructions}

Comment: "${commentText}"

Reply:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 150,
          },
        }),
      }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API error ${res.status}`);
    }
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return reply;
  } catch (e: any) {
    showToast('Gemini AI error: ' + e.message, 'error');
    return '';
  }
}

async function generateSingleReply(commentId: string) {
  const comment = state.comments.find(c => c.commentId === commentId);
  if (!comment) return;

  state.generatingReplies.add(commentId);
  state.openReplyAreas.add(commentId);
  render();

  const videoTitle = state.videos.find(v => v.id?.videoId === state.selectedVideoId)?.snippet?.title || '';
  const reply = await generateReply(comment.textOriginal, videoTitle);

  state.generatingReplies.delete(commentId);
  if (reply) {
    state.replyDrafts.set(commentId, reply);
  }
  render();
}

async function batchGenerateAndReply() {
  if (state.selectedComments.size === 0) return;

  const unreplied = [...state.selectedComments].filter(id => {
    const c = state.comments.find(cm => cm.commentId === id);
    return c && !c.hasOwnerReply;
  });

  if (unreplied.length === 0) {
    showToast('All selected comments already have replies', 'info');
    return;
  }

  showToast(`Generating AI replies for ${unreplied.length} comments...`, 'info');

  const videoTitle = state.videos.find(v => v.id?.videoId === state.selectedVideoId)?.snippet?.title || '';

  for (const commentId of unreplied) {
    const comment = state.comments.find(c => c.commentId === commentId);
    if (!comment) continue;

    state.generatingReplies.add(commentId);
    render();

    const reply = await generateReply(comment.textOriginal, videoTitle);

    state.generatingReplies.delete(commentId);

    if (reply) {
      try {
        await postReply(commentId, reply);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e: any) {
        showToast(`Failed to reply to comment: ${e.message}`, 'error');
      }
    }
    render();
  }

  state.selectedComments.clear();
  showToast('Batch reply complete!', 'success');
  render();
}

// =========================================
// Filtering & Sorting
// =========================================
function getFilteredComments(): any[] {
  let filtered = [...state.comments];

  // Filter
  switch (state.filter) {
    case 'unreplied':
      filtered = filtered.filter(c => !c.hasOwnerReply);
      break;
    case 'replied':
      filtered = filtered.filter(c => c.hasOwnerReply);
      break;
    case 'questions':
      filtered = filtered.filter(c => c.textOriginal?.includes('?'));
      break;
  }

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      c =>
        c.textOriginal?.toLowerCase().includes(q) ||
        c.authorName?.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (state.sortBy) {
    case 'newest':
      filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
      break;
    case 'likes':
      filtered.sort((a, b) => b.likeCount - a.likeCount);
      break;
    case 'replies':
      filtered.sort((a, b) => b.replyCount - a.replyCount);
      break;
  }

  return filtered;
}

// =========================================
// Helpers
// =========================================
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';
  if (seconds < 31536000) return Math.floor(seconds / 2592000) + 'mo ago';
  return Math.floor(seconds / 31536000) + 'y ago';
}

function escHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =========================================
// Render Logic
// =========================================
function render() {
  const app = document.getElementById('app')!;
  const isLoggedIn = !!state.accessToken && !!state.channelId;
  const hasKeys = !!state.apiKey && !!state.clientId;

  app.innerHTML = `
    ${renderNavbar(isLoggedIn)}
    ${isLoggedIn ? renderMainLayout() : renderWelcome(hasKeys)}
    ${renderSettingsModal()}
    ${renderBatchBar()}
  `;

  attachEvents();
}

function renderNavbar(isLoggedIn: boolean): string {
  return `
    <nav class="navbar">
      <div class="navbar-brand">
        <div class="logo-icon">💬</div>
        <span>YT Comment AI</span>
      </div>
      <div class="navbar-actions">
        ${isLoggedIn ? `
          <div class="user-profile">
            ${state.channelAvatar ? `<div class="user-avatar"><img src="${state.channelAvatar}" alt="avatar" /></div>` : ''}
            <span class="user-name">${escHtml(state.channelTitle)}</span>
          </div>
          <button class="btn btn-ghost btn-icon" id="btn-refresh" title="Refresh Videos">🔄</button>
          <button class="btn btn-danger btn-sm" id="btn-logout">Disconnect</button>
        ` : ''}
        <button class="btn btn-secondary btn-icon" id="btn-settings" title="Settings">⚙️</button>
      </div>
    </nav>
  `;
}

function renderWelcome(hasKeys: boolean): string {
  return `
    <div class="welcome-screen">
      <div class="welcome-icon">🤖</div>
      <h1>YouTube Comment AI</h1>
      <p>Manage and auto-reply to your YouTube video comments using AI-powered responses. Smart, fast, and completely free.</p>
      ${hasKeys ? `
        <button class="btn btn-yt btn-lg" id="btn-connect">
          ▶️ Connect YouTube Account
        </button>
        <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border);">
          <strong>Troubleshooting:</strong> If you see "redirect_uri_mismatch", make sure this exact URL is added to your Google Cloud Console "Authorized Redirect URIs":<br/>
          <code style="color: var(--accent-secondary); margin-top: 0.5rem; display: block; background: #000; padding: 0.4rem; border-radius: 4px; border: 1px solid rgba(124, 58, 237, 0.3);">${(window.location.origin + window.location.pathname).replace(/\/$/, '')}</code>
        </div>
      ` : `
        <button class="btn btn-primary btn-lg" id="btn-settings-welcome">
          ⚙️ Set Up API Keys First
        </button>
      `}
      <div class="welcome-steps">
        <div class="welcome-step">
          <div class="step-number">1</div>
          <h3>Add API Keys</h3>
          <p>Set up YouTube & Gemini API keys in Settings</p>
        </div>
        <div class="welcome-step">
          <div class="step-number">2</div>
          <h3>Connect Account</h3>
          <p>Sign in with your YouTube channel</p>
        </div>
        <div class="welcome-step">
          <div class="step-number">3</div>
          <h3>Auto Reply</h3>
          <p>Let AI generate & post replies instantly</p>
        </div>
      </div>
    </div>
  `;
}

function renderMainLayout(): string {
  return `
    <div class="main-content">
      ${renderSidebar()}
      <div class="content-area">
        ${state.selectedVideoId ? renderCommentsPanel() : renderSelectVideoPrompt()}
      </div>
    </div>
  `;
}

function renderSidebar(): string {
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3>📹 Your Videos</h3>
      </div>
      ${state.isLoadingVideos ? `
        <div class="loading-overlay">
          <div class="spinner"></div>
          <span>Loading videos...</span>
        </div>
      ` : `
        <ul class="video-list">
          ${state.videos.map(v => {
            const videoId = v.id?.videoId || '';
            const isActive = videoId === state.selectedVideoId;
            return `
              <li class="video-item ${isActive ? 'active' : ''}" data-videoid="${videoId}">
                <div class="video-thumbnail">
                  <img src="${v.snippet?.thumbnails?.default?.url || ''}" alt="" loading="lazy" />
                </div>
                <div class="video-info">
                  <h4>${escHtml(v.snippet?.title || 'Untitled')}</h4>
                  <div class="video-meta">
                    <span>${timeAgo(v.snippet?.publishedAt || '')}</span>
                  </div>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      `}
    </aside>
  `;
}

function renderSelectVideoPrompt(): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">📺</div>
      <h3>Select a Video</h3>
      <p>Choose a video from the sidebar to view and manage its comments.</p>
    </div>
  `;
}

function renderCommentsPanel(): string {
  const filtered = getFilteredComments();
  const totalComments = state.comments.length;
  const unreplied = state.comments.filter(c => !c.hasOwnerReply).length;
  const replied = state.comments.filter(c => c.hasOwnerReply).length;
  const questions = state.comments.filter(c => c.textOriginal?.includes('?')).length;
  const currentVideo = state.videos.find(v => v.id?.videoId === state.selectedVideoId);

  return `
    <div id="comments-panel">
      <div class="comments-header">
        <h2>${escHtml(currentVideo?.snippet?.title || 'Comments')}</h2>
      </div>

      <!-- Stats -->
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">${totalComments}</div>
          <div class="stat-label">Total Comments</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${unreplied}</div>
          <div class="stat-label">Unreplied</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${replied}</div>
          <div class="stat-label">Replied</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${questions}</div>
          <div class="stat-label">Questions</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="comments-toolbar">
        <div class="filter-pills">
          <button class="filter-pill ${state.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="filter-pill ${state.filter === 'unreplied' ? 'active' : ''}" data-filter="unreplied">Unreplied</button>
          <button class="filter-pill ${state.filter === 'replied' ? 'active' : ''}" data-filter="replied">Replied</button>
          <button class="filter-pill ${state.filter === 'questions' ? 'active' : ''}" data-filter="questions">Questions?</button>
        </div>
        <div class="filter-group">
          <span class="filter-label">Sort</span>
          <select id="sort-select">
            <option value="newest" ${state.sortBy === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="oldest" ${state.sortBy === 'oldest' ? 'selected' : ''}>Oldest</option>
            <option value="likes" ${state.sortBy === 'likes' ? 'selected' : ''}>Most Liked</option>
            <option value="replies" ${state.sortBy === 'replies' ? 'selected' : ''}>Most Replies</option>
          </select>
        </div>
        <input class="search-input" id="search-input" type="text" placeholder="🔍 Search comments..." value="${escHtml(state.searchQuery)}" />
      </div>

      <!-- Tone & Prompt -->
      <div class="prompt-section">
        <label>AI Reply Tone</label>
        <div class="tone-selector">
          <button class="filter-pill ${state.replyTone === 'friendly' ? 'active' : ''}" data-tone="friendly">😊 Friendly</button>
          <button class="filter-pill ${state.replyTone === 'professional' ? 'active' : ''}" data-tone="professional">💼 Professional</button>
          <button class="filter-pill ${state.replyTone === 'casual' ? 'active' : ''}" data-tone="casual">😎 Casual</button>
          <button class="filter-pill ${state.replyTone === 'funny' ? 'active' : ''}" data-tone="funny">😂 Funny</button>
        </div>
      </div>

      <!-- Select All -->
      <div class="select-all-bar" style="margin-top: 1rem;">
        <input type="checkbox" id="select-all-checkbox" ${state.selectedComments.size === filtered.length && filtered.length > 0 ? 'checked' : ''} />
        <span>Select All (${filtered.length} comments)</span>
        ${filtered.length > 0 && state.selectedComments.size === 0 ? `<span style="color: var(--text-muted); font-size: 0.8rem;">— Select comments for batch AI reply</span>` : ''}
      </div>

      ${state.isLoadingComments ? `
        <div class="loading-overlay">
          <div class="spinner"></div>
          <span>Loading comments...</span>
        </div>
      ` : filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <h3>No comments found</h3>
          <p>${state.comments.length === 0 ? 'This video has no comments yet.' : 'No comments match your current filters.'}</p>
        </div>
      ` : `
        <div class="comment-list">
          ${filtered.map(c => renderCommentCard(c)).join('')}
        </div>
      `}

      ${state.nextPageToken ? `
        <div class="pagination">
          <button class="btn btn-secondary" id="btn-load-more">Load More Comments</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCommentCard(comment: any): string {
  const isSelected = state.selectedComments.has(comment.commentId);
  const isGenerating = state.generatingReplies.has(comment.commentId);
  const draft = state.replyDrafts.get(comment.commentId) || '';
  const isReplyOpen = state.openReplyAreas.has(comment.commentId);

  return `
    <div class="comment-card ${isSelected ? 'selected' : ''} ${comment.hasOwnerReply ? 'has-reply' : ''} ${isGenerating ? 'ai-generating' : ''}" data-comment-id="${comment.commentId}">
      <input type="checkbox" class="comment-checkbox" data-check-id="${comment.commentId}" ${isSelected ? 'checked' : ''} />
      <div class="comment-top">
        <div class="comment-avatar">
          <img src="${comment.authorAvatar}" alt="" loading="lazy" />
        </div>
        <div class="comment-header">
          <div class="comment-author">${escHtml(comment.authorName)}</div>
          <div class="comment-date">${timeAgo(comment.publishedAt)}</div>
        </div>
        ${comment.hasOwnerReply ? '<span class="badge badge-success">Replied</span>' : '<span class="badge badge-warning">Unreplied</span>'}
        ${comment.textOriginal?.includes('?') ? '<span class="badge badge-info">Question</span>' : ''}
      </div>
      <div class="comment-body">${comment.text}</div>
      <div class="comment-stats">
        <span class="comment-stat">👍 ${comment.likeCount}</span>
        <span class="comment-stat">💬 ${comment.replyCount} replies</span>
      </div>
      <div class="comment-actions">
        ${!comment.hasOwnerReply ? `
          <button class="btn btn-primary btn-sm" data-ai-reply="${comment.commentId}" ${isGenerating ? 'disabled' : ''}>
            ${isGenerating ? '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Generating...' : '✨ AI Reply'}
          </button>
          <button class="btn btn-secondary btn-sm" data-manual-reply="${comment.commentId}">
            ✏️ Manual Reply
          </button>
        ` : `
          <button class="btn btn-ghost btn-sm" data-toggle-reply="${comment.commentId}">
            ${isReplyOpen ? '🔼 Hide' : '🔽 View Reply'}
          </button>
        `}
      </div>

      ${comment.hasOwnerReply && isReplyOpen ? `
        <div class="existing-reply">
          <div class="reply-label">✅ Your Reply</div>
          <p>${escHtml(comment.ownerReplyText)}</p>
        </div>
      ` : ''}

      ${isReplyOpen && !comment.hasOwnerReply ? `
        <div class="reply-area">
          <textarea class="reply-textarea" data-reply-textarea="${comment.commentId}" placeholder="Type your reply...">${escHtml(draft)}</textarea>
          <div class="reply-actions">
            <button class="btn btn-ghost btn-sm" data-cancel-reply="${comment.commentId}">Cancel</button>
            <button class="btn btn-primary btn-sm" data-ai-gen="${comment.commentId}" ${isGenerating ? 'disabled' : ''}>
              ${isGenerating ? '⏳ Generating...' : '✨ Generate AI'}
            </button>
            <button class="btn btn-success btn-sm" data-send-reply="${comment.commentId}" ${!draft ? 'disabled' : ''}>
              📤 Post Reply
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderSettingsModal(): string {
  return `
    <div class="modal-overlay" id="settings-modal">
      <div class="modal">
        <div class="modal-header">
          <h2>⚙️ Settings</h2>
          <button class="btn btn-ghost btn-icon" id="btn-close-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Authorized Redirect URI</label>
            <div style="background: #000; padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); font-family: monospace; font-size: 0.8rem; color: var(--accent-secondary); word-break: break-all;">
              ${(window.location.origin + window.location.pathname).replace(/\/$/, '')}
            </div>
            <div class="form-hint">Copy this and paste it into "Authorized redirect URIs" in your Google Cloud Console.</div>
          </div>
          <div class="form-group">
            <label for="input-api-key">YouTube API Key</label>
            <input type="password" id="input-api-key" value="${escHtml(state.apiKey)}" placeholder="AIzaSy..." />
            <div class="form-hint">From Google Cloud Console → Credentials → API Keys</div>
          </div>
          <div class="form-group">
            <label for="input-client-id">OAuth Client ID</label>
            <input type="password" id="input-client-id" value="${escHtml(state.clientId)}" placeholder="xxxx.apps.googleusercontent.com" />
            <div class="form-hint">From Google Cloud Console → Credentials → OAuth 2.0 Client IDs</div>
          </div>
          <div class="form-group">
            <label for="input-gemini-key">Gemini API Key</label>
            <input type="password" id="input-gemini-key" value="${escHtml(state.geminiKey)}" placeholder="AIzaSy..." />
            <div class="form-hint">From <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> — 100% free</div>
          </div>
          <div class="form-group">
            <label for="input-custom-prompt">Custom Prompt (Optional)</label>
            <textarea id="input-custom-prompt" rows="3" placeholder="e.g., Always mention my channel name, include a call to action...">${escHtml(state.customPrompt)}</textarea>
            <div class="form-hint">Additional instructions for Gemini when generating replies</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="btn-cancel-settings">Cancel</button>
          <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
        </div>
      </div>
    </div>
  `;
}

function renderBatchBar(): string {
  return `
    <div class="batch-bar ${state.selectedComments.size > 0 ? 'visible' : ''}">
      <span class="batch-count">${state.selectedComments.size} selected</span>
      <button class="btn btn-primary btn-sm" id="btn-batch-ai-reply">✨ AI Reply All</button>
      <button class="btn btn-ghost btn-sm" id="btn-clear-selection">Clear</button>
    </div>
  `;
}

// =========================================
// Event Handling
// =========================================
function attachEvents() {
  // Settings
  document.getElementById('btn-settings')?.addEventListener('click', () => toggleModal(true));
  document.getElementById('btn-settings-welcome')?.addEventListener('click', () => toggleModal(true));
  document.getElementById('btn-close-modal')?.addEventListener('click', () => toggleModal(false));
  document.getElementById('btn-cancel-settings')?.addEventListener('click', () => toggleModal(false));
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);

  // Connect
  document.getElementById('btn-connect')?.addEventListener('click', () => {
    window.location.href = getOAuthUrl();
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    state.accessToken = '';
    state.channelId = '';
    state.channelTitle = '';
    state.channelAvatar = '';
    state.videos = [];
    state.comments = [];
    state.selectedVideoId = '';
    localStorage.removeItem('yt_access_token');
    localStorage.removeItem('yt_channel_id');
    localStorage.removeItem('yt_channel_title');
    localStorage.removeItem('yt_channel_avatar');
    showToast('Disconnected from YouTube', 'info');
    render();
  });

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    fetchVideos();
    showToast('Refreshing videos...', 'info');
  });

  // Video selection
  document.querySelectorAll('.video-item').forEach(el => {
    el.addEventListener('click', () => {
      const videoId = (el as HTMLElement).dataset.videoid || '';
      if (videoId && videoId !== state.selectedVideoId) {
        state.selectedVideoId = videoId;
        state.comments = [];
        state.selectedComments.clear();
        state.openReplyAreas.clear();
        state.replyDrafts.clear();
        render();
        fetchComments(videoId);
      }
    });
  });

  // Filter pills
  document.querySelectorAll('.filter-pill[data-filter]').forEach(el => {
    el.addEventListener('click', () => {
      state.filter = (el as HTMLElement).dataset.filter || 'all';
      render();
    });
  });

  // Tone pills
  document.querySelectorAll('.filter-pill[data-tone]').forEach(el => {
    el.addEventListener('click', () => {
      state.replyTone = (el as HTMLElement).dataset.tone || 'friendly';
      localStorage.setItem('reply_tone', state.replyTone);
      render();
    });
  });

  // Sort
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sortBy = (e.target as HTMLSelectElement).value;
    render();
  });

  // Search
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.searchQuery = (e.target as HTMLInputElement).value;
    render();
    // Re-focus input after render
    const input = document.getElementById('search-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  // Select all
  document.getElementById('select-all-checkbox')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    const filtered = getFilteredComments();
    if (checked) {
      filtered.forEach(c => state.selectedComments.add(c.commentId));
    } else {
      state.selectedComments.clear();
    }
    render();
  });

  // Individual checkboxes
  document.querySelectorAll('.comment-checkbox').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = (el as HTMLElement).dataset.checkId || '';
      if ((e.target as HTMLInputElement).checked) {
        state.selectedComments.add(id);
      } else {
        state.selectedComments.delete(id);
      }
      render();
    });
  });

  // AI Reply buttons
  document.querySelectorAll('[data-ai-reply]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.aiReply || '';
      generateSingleReply(id);
    });
  });

  // Manual Reply buttons
  document.querySelectorAll('[data-manual-reply]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.manualReply || '';
      state.openReplyAreas.add(id);
      render();
    });
  });

  // Toggle existing reply view
  document.querySelectorAll('[data-toggle-reply]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.toggleReply || '';
      if (state.openReplyAreas.has(id)) {
        state.openReplyAreas.delete(id);
      } else {
        state.openReplyAreas.add(id);
      }
      render();
    });
  });

  // Cancel reply
  document.querySelectorAll('[data-cancel-reply]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.cancelReply || '';
      state.openReplyAreas.delete(id);
      state.replyDrafts.delete(id);
      render();
    });
  });

  // Generate AI in reply area
  document.querySelectorAll('[data-ai-gen]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.aiGen || '';
      generateSingleReply(id);
    });
  });

  // Send reply
  document.querySelectorAll('[data-send-reply]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.sendReply || '';
      const draft = state.replyDrafts.get(id);
      if (draft) {
        postReply(id, draft);
      }
    });
  });

  // Reply textarea changes
  document.querySelectorAll('[data-reply-textarea]').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = (el as HTMLElement).dataset.replyTextarea || '';
      state.replyDrafts.set(id, (e.target as HTMLTextAreaElement).value);
      // Update send button state
      const sendBtn = document.querySelector(`[data-send-reply="${id}"]`) as HTMLButtonElement;
      if (sendBtn) sendBtn.disabled = !(e.target as HTMLTextAreaElement).value.trim();
    });
  });

  // Load more
  document.getElementById('btn-load-more')?.addEventListener('click', () => {
    if (state.nextPageToken && state.selectedVideoId) {
      fetchComments(state.selectedVideoId, state.nextPageToken);
    }
  });

  // Batch actions
  document.getElementById('btn-batch-ai-reply')?.addEventListener('click', batchGenerateAndReply);
  document.getElementById('btn-clear-selection')?.addEventListener('click', () => {
    state.selectedComments.clear();
    render();
  });

  // Click outside modal to close
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'settings-modal') {
      toggleModal(false);
    }
  });
}

function toggleModal(show: boolean) {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    if (show) {
      modal.classList.add('visible');
    } else {
      modal.classList.remove('visible');
    }
  }
}

function saveSettings() {
  const apiKey = (document.getElementById('input-api-key') as HTMLInputElement)?.value.trim() || '';
  const clientId = (document.getElementById('input-client-id') as HTMLInputElement)?.value.trim() || '';
  const geminiKey = (document.getElementById('input-gemini-key') as HTMLInputElement)?.value.trim() || '';
  const customPrompt = (document.getElementById('input-custom-prompt') as HTMLTextAreaElement)?.value.trim() || '';

  state.apiKey = apiKey;
  state.clientId = clientId;
  state.geminiKey = geminiKey;
  state.customPrompt = customPrompt;

  localStorage.setItem('yt_api_key', apiKey);
  localStorage.setItem('yt_client_id', clientId);
  localStorage.setItem('gemini_key', geminiKey);
  localStorage.setItem('custom_prompt', customPrompt);

  toggleModal(false);
  showToast('Settings saved!', 'success');
  render();
}

// =========================================
// Init
// =========================================
function init() {
  handleOAuthCallback();
  render();

  // If already logged in, fetch data
  if (state.accessToken) {
    if (!state.channelId) {
      fetchChannelInfo();
    } else {
      fetchVideos();
    }
  }
}

init();
