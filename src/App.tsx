import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// CONSTANTS
// ============================================================
const API_BASE = "https://sushi-sns-api-v2-production.up.railway.app";

// ============================================================
// TYPES
// ============================================================
type Room = string;
type Sub = { id: string; label: string; icon: string; rooms: Room[] };
type Category = { id: string; label: string; icon: string; subs: Sub[] };
type Tier = "normal" | "silver" | "gold";

type Post = {
  id: number;
  content: string;
  likes: number;
  views: number;
  user_id: string;
  room: string;
  created_at: string;
  tier: Tier;
  spoiler: number;
};

type Comment = {
  id: number;
  text: string;
  user_id: string;
  likes: number;
  created_at: string;
  liked_by_user: boolean;
};

type Reply = {
  id: number;
  comment_id: number;
  text: string;
  user_id: string;
  created_at: string;
};

type Bucket = {
  id: number;
  name: string;
  user_id: string;
  created_at: string;
};

type Selected = { cat: Category; sub: Sub; room: string };

type NavPage = "home" | "collection" | "settings";

// ============================================================
// MOCK CATEGORIES (ルーム一覧はフロントで管理)
// ============================================================
const CATEGORIES: Category[] = [
  {
    id: "anime",
    label: "アニメ",
    icon: "📺",
    subs: [
      { id: "chainsaw", label: "チェンソーマン", icon: "🪚", rooms: ["キャラ考察", "デンジ×パワー", "藤本タツキ論", "名シーン保管庫", "アニメvs原作"] },
      { id: "gundam",   label: "ガンダム",       icon: "🤖", rooms: ["シャア考察", "MS設定談義", "一年戦争", "Gレコ再評価", "富野監督語り場"] },
      { id: "oshi",     label: "推しの子",       icon: "⭐", rooms: ["アイ伝説", "ルビー応援", "メタ構造考察", "芸能界リアル談", "最終回予測"] },
    ],
  },
];

// ============================================================
// TIER CONFIG
// ============================================================
type TierConfig = { bg: string; border: string; glow: string; label: string; cardBg: string };

const TIER_CONFIG: Record<Tier, TierConfig> = {
  gold:   { bg: "#f39c12", border: "#f1c40f", glow: "#f1c40f", label: "✨ 金皿", cardBg: "rgba(243,156,18,0.08)" },
  silver: { bg: "#95a5a6", border: "#bdc3c7", glow: "#bdc3c7", label: "🥢 銀皿", cardBg: "rgba(149,165,166,0.06)" },
  normal: { bg: "#c0392b", border: "#e74c3c", glow: "#e74c3c", label: "🥢 赤皿", cardBg: "rgba(192,57,43,0.05)" },
};

// ============================================================
// UUID HELPER
// ============================================================
function getOrCreateUserId(): string {
  const stored = localStorage.getItem("anisushi_user_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("anisushi_user_id", id);
  return id;
}

// ============================================================
// COMPONENTS
// ============================================================

function PlateCard({
  post,
  onLike,
  onUnlike,
  onOpenComments,
  isLiked,
  onAddToBucket,
  userId,
  onDelete,
  reducedMotion,
  showSpoilers,
  fullWidth,
  onConfirming,
}: {
  post: Post;
  onLike: (id: number) => void;
  onUnlike: (id: number) => void;
  onOpenComments: (post: Post) => void;
  isLiked: boolean;
  onAddToBucket?: (post: Post) => void;
  userId?: string;
  onDelete?: (id: number) => void;
  reducedMotion?: boolean;
  showSpoilers?: boolean;
  fullWidth?: boolean;
  onConfirming?: (v: boolean) => void;
}) {
  const tier = TIER_CONFIG[post.tier];
  const [animating, setAnimating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const isOwn = !!userId && post.user_id === userId;
  const rm = !!reducedMotion;
  const isSpoiler = !!post.spoiler && !spoilerRevealed && !showSpoilers;

  const handleLike = () => {
    if (isLiked) {
      onUnlike(post.id);
    } else {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
      onLike(post.id);
    }
  };

  const handleDeleteConfirm = () => {
    fetch(`${API_BASE}/posts/${post.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).then((res) => { if (res.ok) onDelete?.(post.id); });
  };

  return (
    <div
      style={{
        minWidth: fullWidth ? "100%" : 280,
        maxWidth: fullWidth ? "100%" : 280,
        background: tier.cardBg,
        border: `1.5px solid ${tier.border}44`,
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        transition: rm ? "none" : "transform 0.2s, box-shadow 0.2s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (rm) return;
        e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
        e.currentTarget.style.boxShadow = `0 8px 32px ${tier.glow}55`;
      }}
      onMouseLeave={(e) => {
        if (rm) return;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {/* Own-post badge + delete button */}
      {isOwn && (
        <div style={{ position: "absolute", top: 34, right: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, zIndex: 2 }}>
          <div style={{ background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, fontFamily: "'Noto Sans JP', sans-serif", border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(4px)" }}>
            ✍️ あなた
          </div>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); onConfirming?.(true); }}
              style={{ background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.4)", color: "#e74c3c", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.15)"; }}
            >
              取り消す
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {confirming && (
        <div
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", borderRadius: 16, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, backdropFilter: "blur(4px)" }}
          onClick={() => { setConfirming(false); onConfirming?.(false); }}
        >
          <div style={{ color: "#e0e0e0", fontSize: 13, fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif" }}>本当に取り消しますか？</div>
          <div style={{ display: "flex", gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setConfirming(false); onConfirming?.(false); handleDeleteConfirm(); }}
              style={{ padding: "7px 20px", background: "rgba(192,57,43,0.3)", border: "1px solid #e74c3c", borderRadius: 10, color: "#e74c3c", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.55)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(192,57,43,0.3)"; }}
            >
              はい
            </button>
            <button
              onClick={() => { setConfirming(false); onConfirming?.(false); }}
              style={{ padding: "7px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid #333", borderRadius: 10, color: "#aaa", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              いいえ
            </button>
          </div>
        </div>
      )}

      {/* Room tag */}
      <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(255,255,255,0.08)", color: "#aaa", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontFamily: "'Noto Sans JP', sans-serif", zIndex: 2 }}>
        #{post.room || "フリー"}
      </div>

      {/* Spoiler overlay button */}
      {!!post.spoiler && !spoilerRevealed && (
        <div style={{ position: "absolute", top: 36, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 3 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(true); }}
            style={{ padding: "6px 18px", background: "rgba(230,126,34,0.18)", border: "1px solid #e67e22", borderRadius: 20, color: "#e67e22", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", backdropFilter: "blur(4px)" }}
          >
            ⚠ ネタバレ
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "42px 16px 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 22, width: 40, height: 40, background: "rgba(255,255,255,0.05)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${tier.border}33` }}>
            {post.user_id === "system" ? "👤" : "🍣"}
          </div>
          <div>
            <div style={{ color: "#e0e0e0", fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>
              {post.user_id === "system" ? "運営" : "名無しユーザー"}
            </div>
            <div style={{ color: "#555", fontSize: 10, fontFamily: "'Noto Sans JP', sans-serif" }}>
              {post.created_at.slice(0, 16).replace("T", " ")}
            </div>
          </div>
        </div>

        <p style={{ color: "#d0d0d0", fontSize: 13, lineHeight: 1.7, fontFamily: "'Noto Sans JP', sans-serif", margin: 0, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", filter: isSpoiler ? "blur(6px)" : "none", userSelect: isSpoiler ? "none" : "auto", transition: "filter 0.3s" }}>
          {post.content}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleLike}
            style={{ flex: 1, padding: "8px 0", background: isLiked ? `${tier.bg}33` : "rgba(255,255,255,0.04)", border: `1px solid ${isLiked ? tier.glow : "#333"}`, borderRadius: 10, color: isLiked ? tier.glow : "#888", fontSize: 12, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600, transition: rm ? "none" : "all 0.3s", transform: (!rm && animating) ? "scale(1.1)" : "scale(1)" }}
          >
            {isLiked ? "✅" : "🥢"} {post.likes}
          </button>
          <button
            onClick={() => onOpenComments(post)}
            style={{ flex: 1, padding: "8px 0", background: isLiked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isLiked ? "#444" : "#222"}`, borderRadius: 10, color: isLiked ? "#ccc" : "#444", fontSize: 12, cursor: isLiked ? "pointer" : "not-allowed", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.3s" }}
          >
            {isLiked ? "💬 コメント" : "🔒 ロック"}
          </button>
        </div>
        {isLiked && onAddToBucket && (
          <button
            onClick={() => onAddToBucket(post)}
            style={{ width: "100%", marginTop: 6, padding: "7px 0", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a3a", borderRadius: 10, color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#2a2a3a"; }}
          >
            🍱 箱に入れる
          </button>
        )}
      </div>
    </div>
  );
}

function ConveyorBelt({ posts, likedIds, onLike, onUnlike, onOpenComments, userId, onDelete, forcePaused, reducedMotion, showSpoilers, laneCount, lane1Dir, lane2Dir, isMobile }: {
  posts: Post[];
  likedIds: Set<number>;
  onLike: (id: number) => void;
  onUnlike: (id: number) => void;
  onOpenComments: (post: Post) => void;
  userId: string;
  onDelete: (id: number) => void;
  forcePaused?: boolean;
  reducedMotion?: boolean;
  showSpoilers?: boolean;
  laneCount?: 1 | 2;
  lane1Dir?: "rtl" | "ltr";
  lane2Dir?: "rtl" | "ltr";
  isMobile?: boolean;
}) {
  const track1Ref = useRef<HTMLDivElement>(null);
  const track2Ref = useRef<HTMLDivElement>(null);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [confirmPaused, setConfirmPaused] = useState(false);
  const paused = hoverPaused || touchPaused || confirmPaused || !!forcePaused;
  const pos1Ref = useRef(0);
  const pos2Ref = useRef(0);
  const rafRef = useRef<number>(0);

  const isVertical = !!isMobile;

  useEffect(() => {
    const t1 = track1Ref.current;
    const t2 = track2Ref.current;
    if (!t1) return;
    const dir1 = lane1Dir ?? "rtl";
    const dir2 = lane2Dir ?? "ltr";
    const lanes = laneCount ?? 2;
    let last: number | null = null;
    const step = (ts: number) => {
      if (!last) last = ts;
      if (!paused) {
        const delta = (ts - last) * 0.04;
        if (isVertical) {
          const total1 = t1.scrollHeight / 2;
          pos1Ref.current += delta;
          if (pos1Ref.current >= total1) pos1Ref.current -= total1;
          t1.style.transform = `translateY(${pos1Ref.current - total1}px)`;
        } else {
          const total1 = t1.scrollWidth / 2;
          pos1Ref.current += delta;
          if (pos1Ref.current >= total1) pos1Ref.current -= total1;
          t1.style.transform = dir1 === "rtl" ? `translateX(-${pos1Ref.current}px)` : `translateX(${pos1Ref.current - total1}px)`;
          if (lanes === 2 && t2) {
            const total2 = t2.scrollWidth / 2;
            pos2Ref.current += delta;
            if (pos2Ref.current >= total2) pos2Ref.current -= total2;
            t2.style.transform = dir2 === "rtl" ? `translateX(-${pos2Ref.current}px)` : `translateX(${pos2Ref.current - total2}px)`;
          }
        }
      }
      last = ts;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, laneCount, lane1Dir, lane2Dir, isVertical]);

  const doubled = [...posts, ...posts];

  if (isVertical) {
    return (
      <div style={{ position: "relative", overflow: "hidden", height: "65vh" }}
        onClick={() => setTouchPaused((v) => !v)}>
        <div ref={track1Ref} style={{ display: "flex", flexDirection: "column", gap: 16, height: "max-content", padding: "16px 16px", width: "100%", boxSizing: "border-box" }}>
          {doubled.map((post, i) => (
            <PlateCard key={`v-${post.id}-${i}`} post={post} isLiked={likedIds.has(post.id)} onLike={onLike} onUnlike={onUnlike} onOpenComments={onOpenComments} userId={userId} onDelete={onDelete} reducedMotion={reducedMotion} showSpoilers={showSpoilers} fullWidth onConfirming={setConfirmPaused} />
          ))}
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(180deg, #0a0a12, transparent)", zIndex: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(0deg, #0a0a12, transparent)", zIndex: 2, pointerEvents: "none" }} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", padding: isMobile ? "4px 0 8px" : "20px 0" }}
      onMouseEnter={() => setHoverPaused(true)} onMouseLeave={() => setHoverPaused(false)}
      onClick={() => setTouchPaused((v) => !v)}>
      {/* レーン1 */}
      <div style={{ position: "relative", overflow: "hidden", marginBottom: isMobile ? 8 : 16 }}>
        <div ref={track1Ref} style={{ display: "flex", gap: 16, width: "max-content", padding: "0 16px" }}>
          {doubled.map((post, i) => (
            <PlateCard key={`l1-${post.id}-${i}`} post={post} isLiked={likedIds.has(post.id)} onLike={onLike} onUnlike={onUnlike} onOpenComments={onOpenComments} userId={userId} onDelete={onDelete} reducedMotion={reducedMotion} showSpoilers={showSpoilers} onConfirming={setConfirmPaused} />
          ))}
        </div>
      </div>
      {/* レーン2（スマホ横モードでは非表示） */}
      {(laneCount ?? 2) === 2 && !isMobile && (
        <div style={{ position: "relative", overflow: "hidden" }}>
          <div ref={track2Ref} style={{ display: "flex", gap: 16, width: "max-content", padding: "0 16px" }}>
            {doubled.map((post, i) => (
              <PlateCard key={`l2-${post.id}-${i}`} post={post} isLiked={likedIds.has(post.id)} onLike={onLike} onUnlike={onUnlike} onOpenComments={onOpenComments} userId={userId} onDelete={onDelete} reducedMotion={reducedMotion} showSpoilers={showSpoilers} onConfirming={setConfirmPaused} />
            ))}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(90deg, #0a0a12, transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(-90deg, #0a0a12, transparent)", zIndex: 2, pointerEvents: "none" }} />
    </div>
  );
}

function CommentModal({ post, onClose, likedIds, userId, fromBucket, onBackToBucket }: { post: Post; onClose: () => void; likedIds: Set<number>; userId: string; fromBucket?: Bucket; onBackToBucket?: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Record<number, Reply[]>>({});
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const canComment = likedIds.has(post.id);
  const tier = TIER_CONFIG[post.tier];


  const fetchComments = async () => {
    const data: Comment[] = await fetch(`${API_BASE}/posts/${post.id}/comments?user_id=${userId}`)
      .then((r) => r.json()).catch(() => []);
    setComments(data);
    // 全コメントの返信を並列取得
    const entries = await Promise.all(
      data.map(async (c) => {
        const reps: Reply[] = await fetch(`${API_BASE}/comments/${c.id}/replies`)
          .then((r) => r.json()).catch(() => []);
        return [c.id, reps] as [number, Reply[]];
      })
    );
    setReplies(Object.fromEntries(entries));
  };

  useEffect(() => { fetchComments(); }, [post.id]);

  const handleHeartClick = (commentId: number, isLiked: boolean) => {
    if (isLiked) {
      fetch(`${API_BASE}/comments/${commentId}/like`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).then(() => {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, likes: Math.max(0, c.likes - 1), liked_by_user: false } : c));
      });
    } else {
      fetch(`${API_BASE}/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).then(() => {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, likes: c.likes + 1, liked_by_user: true } : c));
      });
    }
  };

  const handleAddReply = async (commentId: number) => {
    const text = (replyTexts[commentId] ?? "").trim();
    if (!text) return;
    const reply: Reply = await fetch(`${API_BASE}/comments/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, user_id: userId }),
    }).then((r) => r.json());
    setReplies((prev) => ({ ...prev, [commentId]: [...(prev[commentId] ?? []), reply] }));
    setReplyTexts((prev) => ({ ...prev, [commentId]: "" }));
    setReplyingTo(null);
  };

  const handleDeleteReply = async (replyId: number, commentId: number) => {
    await fetch(`${API_BASE}/replies/${replyId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setReplies((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? []).filter((r) => r.id !== replyId) }));
  };

  const handleDeleteComment = async (commentId: number) => {
    await fetch(`${API_BASE}/comments/${commentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const submit = async () => {
    if (!input.trim()) return;
    const newComment: Comment = await fetch(`${API_BASE}/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.trim(), user_id: userId }),
    }).then((r) => r.json());
    setComments((prev) => [...prev, { ...newComment, liked_by_user: false }]);
    setReplies((prev) => ({ ...prev, [newComment.id]: [] }));
    setInput("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#0f0f1a", border: "1px solid #333", borderRadius: 20, width: "100%", maxWidth: 540, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        {fromBucket && onBackToBucket && (
          <button onClick={onBackToBucket} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: "rgba(255,255,255,0.03)", border: "none", borderBottom: "1px solid #1a1a2a", color: "#888", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", cursor: "pointer", textAlign: "left", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}>
            ← 🍱 {fromBucket.name}
          </button>
        )}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 700 }}>
            💬 コメント欄 — <span style={{ color: "#888", fontWeight: 400 }}>{post.room || "フリー"}</span>
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "14px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid #1a1a2a", flexShrink: 0 }}>
          <p style={{ color: "#c0c0c0", fontSize: 13, lineHeight: 1.7, margin: 0, fontFamily: "'Noto Sans JP', sans-serif" }}>{post.content}</p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {comments.length === 0 && (
            <div style={{ color: "#444", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center", paddingTop: 20 }}>まだコメントはありません</div>
          )}
          {comments.map((c) => (
            <div key={c.id} style={{ marginBottom: 18 }}>
              {/* コメント本体 */}
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 16, marginTop: 2 }}>💬</span>
                <div style={{ flex: 1 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "8px 12px", border: "1px solid #1f1f2f", position: "relative" }}>
                    {c.user_id === userId && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        style={{ position: "absolute", top: 4, right: 6, background: "none", border: "none", color: "#c0392b", fontSize: 16, cursor: "pointer", padding: "1px 3px", transition: "color 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e74c3c")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#c0392b")}>🗑</button>
                    )}
                    <div style={{ color: "#555", fontSize: 10, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 4 }}>
                      {c.user_id === "system" ? "運営" : c.user_id === userId ? "あなた" : "ユーザー"} · {c.created_at.slice(0, 16).replace("T", " ")}
                    </div>
                    <p style={{ color: "#bbb", fontSize: 13, margin: 0, fontFamily: "'Noto Sans JP', sans-serif", lineHeight: 1.6 }}>{c.text}</p>
                  </div>
                  {/* アクション行 */}
                  <div style={{ display: "flex", gap: 12, marginTop: 5, paddingLeft: 4, alignItems: "center" }}>
                    <button
                      onClick={() => handleHeartClick(c.id, c.liked_by_user)}
                      title={c.liked_by_user ? "タップで取り消し" : "いいね"}
                      style={{ background: "none", border: "none", cursor: "pointer", color: c.liked_by_user ? "#e74c3c" : "#555", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", padding: 0, display: "flex", alignItems: "center", gap: 4, transition: "color 0.15s" }}>
                      {c.liked_by_user ? "❤️" : "🤍"} {c.likes}
                    </button>
                    <button
                      onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", padding: 0, transition: "color 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}>
                      💬 返信{(replies[c.id]?.length ?? 0) > 0 ? ` (${replies[c.id].length})` : ""}
                    </button>
                  </div>

                  {/* 返信一覧 */}
                  {(replies[c.id] ?? []).map((r) => (
                    <div key={r.id} style={{ marginTop: 6, paddingLeft: 14, borderLeft: "2px solid #1a1a2a" }}>
                      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "6px 10px", border: "1px solid #161626", position: "relative" }}>
                        {r.user_id === userId && (
                          <button
                            onClick={() => handleDeleteReply(r.id, c.id)}
                            style={{ position: "absolute", top: 4, right: 6, background: "none", border: "none", color: "#c0392b", fontSize: 16, cursor: "pointer", padding: "1px 3px", transition: "color 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#e74c3c")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#c0392b")}>🗑</button>
                        )}
                        <div style={{ color: "#555", fontSize: 10, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 3 }}>
                          {r.user_id === "system" ? "運営" : r.user_id === userId ? "あなた" : "ユーザー"} · {r.created_at.slice(0, 16).replace("T", " ")}
                        </div>
                        <p style={{ color: "#aaa", fontSize: 12, margin: 0, fontFamily: "'Noto Sans JP', sans-serif", lineHeight: 1.55 }}>{r.text}</p>
                      </div>
                    </div>
                  ))}

                  {/* 返信入力欄 */}
                  {replyingTo === c.id && (
                    <div style={{ marginTop: 8, paddingLeft: 14, display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={replyTexts[c.id] ?? ""}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value.slice(0, 80) }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddReply(c.id)}
                        placeholder="返信（80字まで）"
                        style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3a", borderRadius: 8, padding: "7px 10px", color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, outline: "none" }}
                      />
                      <button onClick={() => handleAddReply(c.id)} style={{ padding: "7px 12px", background: tier.bg, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700 }}>送信</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {canComment ? (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #222", display: "flex", gap: 8, flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="コメント（80字まで）"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 13, outline: "none" }}
            />
            <button onClick={submit} style={{ padding: "10px 16px", background: tier.bg, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>送信</button>
          </div>
        ) : (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #222", textAlign: "center", color: "#444", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", flexShrink: 0 }}>
            🔒 先に皿を取るとコメントできます
          </div>
        )}
      </div>
    </div>
  );
}

function PostModal({ currentRoom, onClose, onPosted, userId }: { currentRoom: string | undefined; onClose: () => void; onPosted: () => void; userId: string }) {
  const [text, setText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const MAX = 80;

  const submit = async () => {
    if (!text.trim()) return;
    await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim(), user_id: userId, room: currentRoom || "", spoiler: isSpoiler }),
    });
    onPosted();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#0f0f1a", border: "1px solid #444", borderRadius: 20, width: "100%", maxWidth: 480, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            🥢 皿に乗せる — <span style={{ color: "#c0392b" }}>#{currentRoom || "ルームを選択"}</span>
          </span>
          <button
            onClick={() => setIsSpoiler((v) => !v)}
            style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${isSpoiler ? "#e67e22" : "#333"}`, background: isSpoiler ? "rgba(230,126,34,0.2)" : "rgba(255,255,255,0.03)", color: isSpoiler ? "#e67e22" : "#555", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s", flexShrink: 0 }}
          >
            ⚠️ ネタバレ注意
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer", marginLeft: "auto" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder={`${currentRoom || "このルーム"}への投稿（${MAX}字まで）\n刺激的な考察・感想・発見を...`}
            style={{ width: "100%", height: 120, background: "rgba(255,255,255,0.04)", border: "1px solid #333", borderRadius: 12, padding: "12px 14px", color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, outline: "none", resize: "none", lineHeight: 1.7, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ color: text.length > MAX * 0.85 ? "#e74c3c" : "#555", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif" }}>
              {text.length} / {MAX}
            </div>
            <button
              onClick={submit}
              disabled={!text.trim()}
              style={{ padding: "8px 20px", background: text.trim() ? "#c0392b" : "#333", border: "none", borderRadius: 8, color: text.trim() ? "#fff" : "#555", cursor: text.trim() ? "pointer" : "not-allowed", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700 }}
            >
              投稿する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose, reducedMotion, onToggleReducedMotion, showSpoilers, onToggleShowSpoilers, laneCount, onSetLaneCount, lane1Dir, onSetLane1Dir, lane2Dir, onSetLane2Dir, isMobile }: {
  onClose: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  showSpoilers: boolean;
  onToggleShowSpoilers: () => void;
  laneCount: 1 | 2;
  onSetLaneCount: (n: 1 | 2) => void;
  lane1Dir: "rtl" | "ltr";
  onSetLane1Dir: (d: "rtl" | "ltr") => void;
  lane2Dir: "rtl" | "ltr";
  onSetLane2Dir: (d: "rtl" | "ltr") => void;
  isMobile: boolean;
}) {
  const pending = ["流れる速さの調節", "ダークモード切り替え", "SEのオン・オフ", "BGMのオン・オフ", "文字サイズの調節", "言語切り替え"];

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? "#c0392b" : "#2a2a3a", position: "relative", cursor: "pointer", transition: "background 0.2s", border: `1px solid ${on ? "#e74c3c" : "#444"}`, flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
  );

  const DirSelect = ({ value, onChange }: { value: "rtl" | "ltr"; onChange: (d: "rtl" | "ltr") => void }) => (
    <div style={{ display: "flex", gap: 4 }}>
      {(["rtl", "ltr"] as const).map((d) => (
        <button key={d} onClick={() => onChange(d)} style={{ padding: "3px 10px", borderRadius: 8, border: `1px solid ${value === d ? "#e74c3c" : "#333"}`, background: value === d ? "rgba(192,57,43,0.2)" : "rgba(255,255,255,0.03)", color: value === d ? "#e74c3c" : "#666", fontSize: 11, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600 }}>
          {d === "rtl" ? "右→左" : "左→右"}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#0f0f1a", border: "1px solid #333", borderRadius: 20, width: "100%", maxWidth: 420, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 700 }}>⚙️ 設定</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>

          {/* レーン数・向き（PCのみ） */}
          {!isMobile && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
                <span style={{ color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>流れるレーン数</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {([1, 2] as const).map((n) => (
                    <button key={n} onClick={() => onSetLaneCount(n)} style={{ padding: "3px 14px", borderRadius: 8, border: `1px solid ${laneCount === n ? "#e74c3c" : "#333"}`, background: laneCount === n ? "rgba(192,57,43,0.2)" : "rgba(255,255,255,0.03)", color: laneCount === n ? "#e74c3c" : "#666", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                      {n}本
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
                <span style={{ color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>1本目の向き</span>
                <DirSelect value={lane1Dir} onChange={onSetLane1Dir} />
              </div>
              {laneCount === 2 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
                  <span style={{ color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>2本目の向き</span>
                  <DirSelect value={lane2Dir} onChange={onSetLane2Dir} />
                </div>
              )}
            </>
          )}

          {/* ネタバレを表示 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
            <span style={{ color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>ネタバレを表示</span>
            <Toggle on={showSpoilers} onToggle={onToggleShowSpoilers} />
          </div>

          {/* アニメーション簡略化 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
            <span style={{ color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>アニメーション簡略化</span>
            <Toggle on={reducedMotion} onToggle={onToggleReducedMotion} />
          </div>

          {pending.map((label) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a1a2a" }}>
              <span style={{ color: "#888", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>{label}</span>
              <span style={{ color: "#555", fontSize: 11, fontFamily: "'Noto Sans JP', sans-serif" }}>🚧 準備中</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BucketSelectorModal({ post, buckets, userId, onClose, onBucketCreated, onAdded }: {
  post: Post;
  buckets: Bucket[];
  userId: string;
  onClose: () => void;
  onBucketCreated: (b: Bucket) => void;
  onAdded: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const addToExisting = async (bucketId: number) => {
    if (adding) return;
    setAdding(true);
    await fetch(`${API_BASE}/buckets/${bucketId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, user_id: userId }),
    });
    onAdded();
    onClose();
  };

  const createAndAdd = async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    const res = await fetch(`${API_BASE}/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), user_id: userId }),
    });
    const bucket: Bucket = await res.json();
    onBucketCreated(bucket);
    await fetch(`${API_BASE}/buckets/${bucket.id}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, user_id: userId }),
    });
    onAdded();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: 20, width: "100%", maxWidth: 380, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 700 }}>🍱 どの箱に入れますか？</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 16, maxHeight: 360, overflowY: "auto" }}>
          {buckets.length === 0 && (
            <div style={{ color: "#444", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center", paddingBottom: 12 }}>まだ箱がありません</div>
          )}
          {buckets.map((b) => (
            <div key={b.id} onClick={() => addToExisting(b.id)}
              style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #1f1f2f", borderRadius: 10, marginBottom: 8, cursor: "pointer", color: "#ccc", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}>
              <span style={{ fontSize: 18 }}>🍱</span>
              <span>{b.name}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, borderTop: "1px solid #1a1a2a", paddingTop: 12 }}>
            <div style={{ color: "#555", fontSize: 11, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 8 }}>新しい箱を作って追加</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                placeholder="箱の名前（20字まで）"
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none" }}
              />
              <button onClick={createAndAdd} disabled={!newName.trim()}
                style={{ padding: "8px 14px", background: newName.trim() ? "#c0392b" : "#222", border: "none", borderRadius: 8, color: newName.trim() ? "#fff" : "#444", cursor: newName.trim() ? "pointer" : "not-allowed", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700 }}>
                作る
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketDetailModal({ bucket, userId, onClose, likedIds, onOpenComments }: {
  bucket: Bucket;
  userId: string;
  onClose: () => void;
  likedIds: Set<number>;
  onOpenComments: (post: Post) => void;
}) {
  const [bucketPosts, setBucketPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/buckets/${bucket.id}/posts?user_id=${userId}`)
      .then((r) => r.json())
      .then((data: Post[]) => setBucketPosts(data))
      .catch(() => {});
  }, [bucket.id, userId]);

  const removePost = async (postId: number) => {
    await fetch(`${API_BASE}/buckets/${bucket.id}/posts/${postId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setBucketPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a2a", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ color: "#e0e0e0", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 700 }}>🍱 {bucket.name}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {bucketPosts.length === 0 && (
            <div style={{ color: "#444", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center", paddingTop: 24 }}>箱の中は空です</div>
          )}
          {bucketPosts.map((post) => {
            const tier = TIER_CONFIG[post.tier ?? "normal"];
            return (
              <div key={post.id} style={{ background: tier.cardBg, border: `1px solid ${tier.border}33`, borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{ flex: 1, cursor: "pointer" }}
                  onClick={() => onOpenComments(post)}
                >
                  <div style={{ color: "#666", fontSize: 10, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>#{post.room || "フリー"}</span>
                    <span style={{ color: likedIds.has(post.id) ? tier.glow : "#555" }}>🥢 {post.likes}</span>
                  </div>
                  <p style={{ color: "#ccc", fontSize: 13, margin: 0, fontFamily: "'Noto Sans JP', sans-serif", lineHeight: 1.65 }}>{post.content}</p>
                </div>
                <button onClick={() => removePost(post.id)}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a3a", borderRadius: 8, color: "#555", fontSize: 11, cursor: "pointer", padding: "5px 10px", fontFamily: "'Noto Sans JP', sans-serif", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#e74c3c"; e.currentTarget.style.borderColor = "#e74c3c44"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#2a2a3a"; }}>
                  出す
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ categories, selected, onSelect, activePage, onChangePage }: {
  categories: Category[];
  selected: Selected | null;
  onSelect: (s: Selected) => void;
  activePage: NavPage;
  onChangePage: (p: NavPage) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>("anime");

  return (
    <div style={{ width: 220, background: "rgba(8,8,18,0.98)", borderRight: "1px solid #1a1a2a", height: "100%", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      {/* Logo */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #1a1a2a", cursor: "pointer" }} onClick={() => onChangePage("home")}>
        <img src="/logo.svg" alt="あにすし" style={{ height: 40 }} />
      </div>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid #1a1a2a", padding: "8px 0" }}>
        {([
          ["home",       "🏠", "ホーム"],
          ["collection", "🍱", "コレクション"],
        ] as [NavPage, string, string][]).map(([page, icon, label]) => (
          <div key={page} onClick={() => onChangePage(page)} style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: activePage === page ? "#c0392b" : "#555", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600, background: activePage === page ? "rgba(192,57,43,0.08)" : "transparent", transition: "all 0.2s" }}>
            <span>{icon}</span><span>{label}</span>
          </div>
        ))}
        {(["👤 プロフィール", "🔔 通知"] as string[]).map((item) => (
          <div key={item} style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed", color: "#333", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>
            <span>{item}</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#444", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 4 }}>準備中</span>
          </div>
        ))}
        <div onClick={() => onChangePage("settings")} style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: activePage === "settings" ? "#c0392b" : "#555", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600, background: activePage === "settings" ? "rgba(192,57,43,0.08)" : "transparent", transition: "all 0.2s" }}
          onMouseEnter={(e) => { if (activePage !== "settings") e.currentTarget.style.color = "#aaa"; }}
          onMouseLeave={(e) => { if (activePage !== "settings") e.currentTarget.style.color = "#555"; }}>
          <span>⚙️</span><span>設定</span>
        </div>
      </div>

      {/* Categories (ホームのみ) */}
      {activePage === "home" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {categories.map((cat) => (
            <div key={cat.id}>
              <div onClick={() => setExpanded(expanded === cat.id ? null : cat.id)} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: expanded === cat.id ? "#e0e0e0" : "#666", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 700, background: expanded === cat.id ? "rgba(255,255,255,0.04)" : "transparent", transition: "all 0.2s" }}>
                <span>{cat.icon}</span><span>{cat.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#444" }}>{expanded === cat.id ? "▼" : "▶"}</span>
              </div>
              {expanded === cat.id && cat.subs.map((sub) => (
                <div key={sub.id}>
                  <div onClick={() => onSelect({ cat, sub, room: sub.rooms[0] })} style={{ padding: "8px 16px 8px 32px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: selected?.sub?.id === sub.id ? "#c0392b" : "#555", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600, background: selected?.sub?.id === sub.id ? "rgba(192,57,43,0.08)" : "transparent", transition: "all 0.15s" }}>
                    <span style={{ fontSize: 14 }}>{sub.icon}</span><span>{sub.label}</span>
                  </div>
                  {selected?.sub?.id === sub.id && sub.rooms.map((room) => (
                    <div key={room} onClick={() => onSelect({ cat, sub, room })} style={{ padding: "6px 16px 6px 48px", cursor: "pointer", color: selected?.room === room ? "#e0e0e0" : "#444", fontSize: 11, fontFamily: "'Noto Sans JP', sans-serif", background: selected?.room === room ? "rgba(255,255,255,0.03)" : "transparent", borderLeft: selected?.room === room ? "2px solid #c0392b" : "2px solid transparent", transition: "all 0.15s" }}>
                      #{room}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function BottomNav({ activePage, onChangePage }: { activePage: NavPage; onChangePage: (p: NavPage) => void }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,8,18,0.98)", borderTop: "1px solid #1a1a2a", display: "flex", zIndex: 50 }}>
      {([
        ["home",       "🏠", "ホーム"],
        ["collection", "🍱", "コレクション"],
        ["settings",   "⚙️", "設定"],
      ] as [NavPage, string, string][]).map(([page, icon, label]) => (
        <div key={page} onClick={() => onChangePage(page)} style={{ flex: 1, padding: "10px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: activePage === page ? "#c0392b" : "#444" }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 9, fontFamily: "'Noto Sans JP', sans-serif" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function StatsBar({ posts, likedIds }: { posts: Post[]; likedIds: Set<number> }) {
  const goldCount = posts.filter((p) => p.tier === "gold").length;
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a2a", background: "rgba(5,5,12,0.9)" }}>
      {([
        ["🥢", "総皿数",   posts.length],
        ["✅", "取った皿", likedIds.size],
        ["✨", "金皿",     goldCount],
      ] as [string, string, number][]).map(([icon, label, val]) => (
        <div key={label} style={{ flex: 1, padding: "10px 0", textAlign: "center", borderRight: "1px solid #1a1a2a" }}>
          <div style={{ fontSize: 16 }}>{icon}</div>
          <div style={{ color: "#e0e0e0", fontSize: 15, fontWeight: 700, fontFamily: "'Noto Serif JP', serif" }}>{val}</div>
          <div style={{ color: "#444", fontSize: 10, fontFamily: "'Noto Sans JP', sans-serif" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [userId] = useState(() => getOrCreateUserId());
  const [selected, setSelected] = useState<Selected>({ cat: CATEGORIES[0], sub: CATEGORIES[0].subs[0], room: CATEGORIES[0].subs[0].rooms[0] });
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [commentFromBucket, setCommentFromBucket] = useState<Bucket | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [laneCount, setLaneCount] = useState<1 | 2>(2);
  const [lane1Dir, setLane1Dir] = useState<"rtl" | "ltr">("rtl");
  const [lane2Dir, setLane2Dir] = useState<"rtl" | "ltr">("ltr");
  const [activeTab, setActiveTab] = useState<"feed" | "room">("feed");
  const [activePage, setActivePage] = useState<NavPage>("home");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Bucket state
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketTarget, setBucketTarget] = useState<Post | null>(null);
  const [viewingBucket, setViewingBucket] = useState<Bucket | null>(null);
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const newBucketInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const fetchPosts = useCallback(() => {
    fetch(`${API_BASE}/posts`)
      .then((r) => r.json())
      .then((data: Post[]) => setPosts(data))
      .catch(() => {});
  }, []);

  const fetchLikedIds = useCallback(() => {
    fetch(`${API_BASE}/posts/liked?user_id=${userId}`)
      .then((r) => r.json())
      .then((ids: number[]) => setLikedIds(new Set(ids)))
      .catch(() => {});
  }, [userId]);

  const fetchBuckets = useCallback(() => {
    fetch(`${API_BASE}/buckets?user_id=${userId}`)
      .then((r) => r.json())
      .then((data: Bucket[]) => setBuckets(data))
      .catch(() => {});
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { fetchLikedIds(); }, [fetchLikedIds]);
  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  const handleLike = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/posts/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setLikedIds((prev) => { const n = new Set(prev); n.add(id); return n; });
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, likes: p.likes + 1 } : p));
  }, [userId]);

  const handleUnlike = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/posts/${id}/like`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setLikedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
  }, [userId]);

  const handleOpenComments = useCallback((post: Post) => {
    setCommentPost(post);
  }, []);

  const handleDeletePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setLikedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const handleChangePage = (page: NavPage) => {
    if (page === "settings") { setShowSettings(true); return; }
    setActivePage(page);
  };

  const getNextBucketName = () => {
    const base = "新しい箱";
    const names = new Set(buckets.map((b) => b.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base} (${i})`;
      if (!names.has(candidate)) return candidate;
    }
  };

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) { setCreatingBucket(false); return; }
    setCreatingBucket(false);
    const res = await fetch(`${API_BASE}/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBucketName.trim(), user_id: userId }),
    });
    const bucket: Bucket = await res.json();
    setBuckets((prev) => [...prev, bucket]);
    setNewBucketName("");
  };

  const handleDeleteBucket = async (bucketId: number) => {
    await fetch(`${API_BASE}/buckets/${bucketId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setBuckets((prev) => prev.filter((b) => b.id !== bucketId));
  };

  const likedPosts = posts.filter((p) => likedIds.has(p.id));

  const filteredPosts = activeTab === "room"
    ? posts.filter((p) => p.room === selected?.room)
    : posts;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a12", fontFamily: "'Noto Sans JP', sans-serif", overflow: "hidden" }}>

      {/* Sidebar (PC only) */}
      {!isMobile && (
        <Sidebar
          categories={CATEGORIES}
          selected={selected}
          onSelect={(s) => { setSelected(s); setActivePage("home"); }}
          activePage={activePage}
          onChangePage={handleChangePage}
        />
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: isMobile ? 60 : 0 }}>

        {/* Header */}
        <div style={{ padding: "14px 24px", background: "rgba(8,8,18,0.95)", borderBottom: "1px solid #1a1a2a", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(10px)", flexShrink: 0 }}>
          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/logo.svg" alt="あにすし" style={{ height: 24 }} />
              <div style={{ display: "flex", gap: 10 }}>
                {([
                  ["🥢", posts.length],
                  ["✅", likedIds.size],
                  ["✨", posts.filter((p) => p.tier === "gold").length],
                ] as [string, number][]).map(([icon, val]) => (
                  <div key={icon} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11 }}>{icon}</div>
                    <div style={{ color: "#e0e0e0", fontSize: 11, fontWeight: 700, fontFamily: "'Noto Serif JP', serif", lineHeight: 1 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: "#e0e0e0", fontSize: 16, fontWeight: 700, fontFamily: "'Noto Serif JP', serif" }}>
                {activePage === "collection"
                  ? "🍱 コレクション"
                  : `${selected?.sub?.icon ?? ""} ${selected?.sub?.label ?? ""} › #${selected?.room ?? "ホーム"}`}
              </div>
              <div style={{ color: "#444", fontSize: 10, marginTop: 2 }}>
                {activePage === "collection" ? "取った皿・箱を管理" : "回転中・ホバーで停止"}
              </div>
            </div>
          )}
          <button onClick={() => setShowPost(true)} style={{ padding: "8px 18px", background: "#c0392b", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif", boxShadow: "0 0 20px #c0392b55" }}>
            + 皿を出す
          </button>
        </div>

        {/* Stats (PC only) */}
        {!isMobile && <StatsBar posts={posts} likedIds={likedIds} />}

        {/* Tabs (ホームのみ) */}
        {activePage === "home" && (
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a2a", background: "rgba(5,5,12,0.9)", flexShrink: 0 }}>
            {([["feed", "🌊 全体フィード"], ["room", "🏠 このルーム"]] as ["feed" | "room", string][]).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{ padding: "10px 20px", background: "none", border: "none", color: activeTab === key ? "#c0392b" : "#555", borderBottom: activeTab === key ? "2px solid #c0392b" : "2px solid transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* ===== Collection page ===== */}
          {activePage === "collection" ? (
            <div style={{ padding: 24 }}>

              {/* 取った皿 */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ color: "#e0e0e0", fontSize: 11, letterSpacing: 2, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 16 }}>━━ 取った皿 ━━</div>
                {likedPosts.length === 0 ? (
                  <div style={{ color: "#333", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>まだ皿を取っていません。気に入った投稿を取ってみてください！</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {likedPosts.map((post) => (
                      <PlateCard
                        key={post.id}
                        post={post}
                        isLiked={true}
                        onLike={handleLike}
                        onUnlike={handleUnlike}
                        onOpenComments={handleOpenComments}
                        onAddToBucket={(p) => setBucketTarget(p)}
                        userId={userId}
                        onDelete={handleDeletePost}
                        reducedMotion={reducedMotion}
                        showSpoilers={showSpoilers}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 箱一覧 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ color: "#e0e0e0", fontSize: 11, letterSpacing: 2, fontFamily: "'Noto Sans JP', sans-serif" }}>━━ 箱一覧 ━━</div>
                  <button
                    onClick={() => { setNewBucketName(getNextBucketName()); setCreatingBucket(true); }}
                    style={{ padding: "6px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3a", borderRadius: 8, color: "#777", fontSize: 12, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#555"; e.currentTarget.style.color = "#bbb"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a3a"; e.currentTarget.style.color = "#777"; }}>
                    ＋ 箱を作る
                  </button>
                </div>

                {creatingBucket && (
                  <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                    <input
                      ref={newBucketInputRef}
                      autoFocus
                      value={newBucketName}
                      onChange={(e) => setNewBucketName(e.target.value.slice(0, 20))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateBucket();
                        if (e.key === "Escape") { setCreatingBucket(false); setNewBucketName(""); }
                      }}
                      onBlur={() => { setCreatingBucket(false); setNewBucketName(""); }}
                      style={{ flex: 1, boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid #555", borderRadius: 8, padding: "8px 12px", color: "#e0e0e0", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none" }}
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleCreateBucket}
                      style={{ padding: "8px 16px", background: "rgba(192,57,43,0.2)", border: "1px solid #e74c3c", borderRadius: 8, color: "#e74c3c", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", whiteSpace: "nowrap" }}
                    >
                      決定
                    </button>
                  </div>
                )}

                {buckets.length === 0 && !creatingBucket ? (
                  <div style={{ color: "#333", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>まだ箱がありません。箱を作って皿を整理しましょう！</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                    {buckets.map((b) => (
                      <div key={b.id}
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1f1f2f", borderRadius: 14, padding: "18px 16px", textAlign: "center", transition: "all 0.2s", position: "relative" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "#333"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "#1f1f2f"; }}>
                        <div onClick={() => setViewingBucket(b)} style={{ cursor: "pointer" }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>🍱</div>
                          <div style={{ color: "#ccc", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 600 }}>{b.name}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBucket(b.id); }}
                          style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#c0392b", fontSize: 21, cursor: "pointer", padding: "2px 4px", borderRadius: 4, transition: "color 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#e74c3c")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#c0392b")}
                        >🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 出した皿 */}
              {(() => {
                const myPosts = posts.filter((p) => p.user_id === userId);
                if (myPosts.length === 0) return null;
                return (
                  <div style={{ marginTop: 36 }}>
                    <div style={{ color: "#e0e0e0", fontSize: 11, letterSpacing: 2, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 16 }}>━━ 出した皿 ━━</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {myPosts.map((post) => (
                        <PlateCard key={post.id} post={post} isLiked={likedIds.has(post.id)} onLike={handleLike} onUnlike={handleUnlike} onOpenComments={handleOpenComments} userId={userId} onDelete={handleDeletePost} reducedMotion={reducedMotion} showSpoilers={showSpoilers} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

          ) : (
            /* ===== Home page ===== */
            filteredPosts.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#333", fontFamily: "'Noto Sans JP', sans-serif", fontSize: 13 }}>
                このルームにはまだ投稿がありません。最初の皿を出しましょう！
              </div>
            ) : (
              <>
                <div style={{ padding: "12px 24px 4px", flexShrink: 0 }}>
                  <div style={{ color: "#e0e0e0", fontSize: 11, letterSpacing: 2, fontFamily: "'Noto Sans JP', sans-serif" }}>━━ 皿が流れています。気に入ったら取ってください ━━</div>
                </div>
                <ConveyorBelt posts={filteredPosts} likedIds={likedIds} onLike={handleLike} onUnlike={handleUnlike} onOpenComments={handleOpenComments} userId={userId} onDelete={handleDeletePost} forcePaused={showSettings} reducedMotion={reducedMotion} showSpoilers={showSpoilers} laneCount={laneCount} lane1Dir={lane1Dir} lane2Dir={lane2Dir} isMobile={isMobile} />
                <div style={{ padding: "24px", borderTop: "1px solid #1a1a2a" }}>
                  <div style={{ color: "#e0e0e0", fontSize: 11, letterSpacing: 2, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: 16 }}>━━ 全ての皿 ━━</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {filteredPosts.map((post) => (
                      <PlateCard key={post.id} post={post} isLiked={likedIds.has(post.id)} onLike={handleLike} onUnlike={handleUnlike} onOpenComments={handleOpenComments} userId={userId} onDelete={handleDeletePost} reducedMotion={reducedMotion} showSpoilers={showSpoilers} />
                    ))}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* Bottom nav (mobile only) */}
      {isMobile && <BottomNav activePage={activePage} onChangePage={handleChangePage} />}

      {/* Modals */}
      {commentPost && <CommentModal post={commentPost} onClose={() => { setCommentPost(null); setCommentFromBucket(null); }} likedIds={likedIds} userId={userId} fromBucket={commentFromBucket ?? undefined} onBackToBucket={commentFromBucket ? () => { setCommentPost(null); setViewingBucket(commentFromBucket); setCommentFromBucket(null); } : undefined} />}
      {showPost && <PostModal currentRoom={selected?.room} onClose={() => setShowPost(false)} onPosted={fetchPosts} userId={userId} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} reducedMotion={reducedMotion} onToggleReducedMotion={() => setReducedMotion((v) => !v)} showSpoilers={showSpoilers} onToggleShowSpoilers={() => setShowSpoilers((v) => !v)} laneCount={laneCount} onSetLaneCount={setLaneCount} lane1Dir={lane1Dir} onSetLane1Dir={setLane1Dir} lane2Dir={lane2Dir} onSetLane2Dir={setLane2Dir} isMobile={isMobile} />}
      {bucketTarget && (
        <BucketSelectorModal
          post={bucketTarget}
          buckets={buckets}
          userId={userId}
          onClose={() => setBucketTarget(null)}
          onBucketCreated={(b) => setBuckets((prev) => [...prev, b])}
          onAdded={() => {}}
        />
      )}
      {viewingBucket && (
        <BucketDetailModal
          bucket={viewingBucket}
          userId={userId}
          onClose={() => setViewingBucket(null)}
          likedIds={likedIds}
          onOpenComments={(post) => {
            setCommentFromBucket(viewingBucket);
            setCommentPost(post);
            setViewingBucket(null);
          }}
        />
      )}
    </div>
  );
}
