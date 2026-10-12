"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GachaTier,
  Kanji,
  Question,
  QuizResult,
  StudyItem,
  StudyMode,
  Tab,
  Vocab,
} from "@/lib/types";
import { DEFAULT_TIERS } from "@/lib/gacha";
import { buildQuiz, sample, shuffle } from "@/lib/quiz";
import { APP_ID, getSupabase, isSupabaseConfigured, todayVN } from "@/lib/supabase/client";
import {
  DEMO_COMPLETED,
  demoAppState,
  demoCalendar,
  demoKanji,
  demoTiers,
  demoVocab,
} from "@/lib/supabase/demo";
import {
  bulkAssignLesson,
  completeSession,
  deleteKanji,
  deleteVocab,
  ensureAppState,
  getAllKanji,
  getAllVocab,
  getGachaTiers,
  getKanjiByDate,
  getKanjiByLesson,
  getLessonStats,
  getStudyCalendar,
  getTodaySessions,
  getTodaySpins,
  getVocabByDate,
  getVocabByLesson,
  logAttempts,
  startSession,
  spinWheel,
  touchDay,
} from "@/lib/supabase/queries";
import { QuizPlayer } from "@/components/quiz-player";
import { ResultScreen } from "@/components/result-screen";
import { RogueScreen } from "@/components/rogue-screen";
import { BottomNav } from "@/components/tabs/bottom-nav";
import { HomeTab } from "@/components/tabs/home-tab";
import { KanjiTab } from "@/components/tabs/kanji-tab";
import { LearnTab } from "@/components/tabs/learn-tab";
import { ReviewTab } from "@/components/tabs/review-tab";
import { StatsTab } from "@/components/tabs/stats-tab";
import { LoadingScreen, SetupScreen } from "@/components/screens";
import { ErrorNote } from "@/components/ui";

// ═══════════════════════════════════════════════════════════════
//  App shell — điều phối state + điều hướng
// ═══════════════════════════════════════════════════════════════

type Screen =
  | { kind: "tabs" }
  | { kind: "quiz"; mode: StudyMode; title: string }
  | { kind: "result"; mode: StudyMode; result: QuizResult }
  | { kind: "rogue"; mode: "vocab" | "kanji" };

type AnswerRow = {
  mode: "vocab" | "kanji";
  itemId: string;
  question: string;
  correct: boolean;
  answerMs: number;
  combo: number;
};

export default function KotobaApp() {
  // Demo mode được ưu tiên khi bật, bỏ qua hoàn toàn Supabase.
  // Đọc env lúc runtime (không ở module scope) để Turbopack không cache
  // giá trị cũ khi bật/tắt demo mode.
  const [demoMode, setDemoMode] = useState(
    process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  );
  const [configured] = useState(
    (process.env.NEXT_PUBLIC_DEMO_MODE === "true") || isSupabaseConfigured,
  );
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // ── Dữ liệu ──
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [kanji, setKanji] = useState<Kanji[]>([]);
  const [tiers, setTiers] = useState<GachaTier[]>(DEFAULT_TIERS);
  const [diamonds, setDiamonds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [missedDays, setMissedDays] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState<Set<string>>(new Set());
  const [todaySpun, setTodaySpun] = useState<Set<string>>(new Set());
  const [calendar, setCalendar] = useState<Record<string, number>>({});
  // Stats theo lesson: { 1: 6, 2: 10, ... }
  const [vocabLessons, setVocabLessons] = useState<Record<number, number>>({});
  const [kanjiLessons, setKanjiLessons] = useState<Record<number, number>>({});

  // ── Điều hướng ──
  const [tab, setTab] = useState<Tab>("home");
  const [screen, setScreen] = useState<Screen>({ kind: "tabs" });

  // ── Refs nội bộ ──
  const answerBuffer = useRef<AnswerRow[]>([]);
  const sessionIdRef = useRef<string>("");
  const modeRef = useRef<StudyMode>("daily");
  const tierRef = useRef<GachaTier | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);

  // ═══════════════════════════════════════════════════════════
  //  Khởi tạo
  // ═══════════════════════════════════════════════════════════

  const demoLoad = useCallback(() => {
    setDiamonds(demoAppState().diamonds);
    setStreak(demoAppState().current_streak);
    const v = demoVocab();
    const k = demoKanji();
    setVocab(v);
    setKanji(k);
    setTiers(demoTiers());
    setCalendar(demoCalendar());
    setTodayCompleted(DEMO_COMPLETED);
    setTodaySpun(new Set<string>());
    setMissedDays(0);
    // Tính lesson stats từ demo
    const vStats: Record<number, number> = {};
    const kStats: Record<number, number> = {};
    for (const x of v) {
      if (x.lesson_number > 0) vStats[x.lesson_number] = (vStats[x.lesson_number] ?? 0) + 1;
    }
    for (const x of k) {
      if (x.lesson_number > 0) kStats[x.lesson_number] = (kStats[x.lesson_number] ?? 0) + 1;
    }
    setVocabLessons(vStats);
    setKanjiLessons(kStats);
  }, []);

  const loadAll = useCallback(async () => {
    if (demoMode) {
      demoLoad();
      return;
    }

    const [state, v, k, t, sessions, spins, cal, vLessons, kLessons] =
      await Promise.all([
        ensureAppState(),
        getAllVocab(),
        getAllKanji(),
        getGachaTiers(),
        getTodaySessions(),
        getTodaySpins(),
        getStudyCalendar(),
        getLessonStats("vocab"),
        getLessonStats("kanji"),
      ]);

    setDiamonds(state.diamonds);
    setStreak(state.current_streak);
    setVocab(v);
    setKanji(k);
    setTiers(t);
    setCalendar(cal);
    setVocabLessons(vLessons);
    setKanjiLessons(kLessons);
    setTodayCompleted(new Set(sessions.filter((s) => s.completed).map((s) => s.mode)));
    setTodaySpun(new Set(spins.map((s) => `${s.mode}:${s.kind}`)));

    try {
      const missed = await touchDay(todayVN());
      setMissedDays(missed);
    } catch {
      setMissedDays(0);
    }
  }, [demoMode, demoLoad]);

  // Tải dữ liệu ban đầu từ Supabase: tác vụ bất đồng bộ, không thể tránh
// setState trong effect.
useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll()
      .catch((e) => {
        if (cancelled) return;
        // Supabase chưa cấu hình / sai key / mất mạng → tự chuyển sang demo
        // để app vẫn dùng được thay vì trắng màn hình.
        setDemoMode(true);
        setFatalError(null);
        console.warn("[kotoba] Không kết nối được Supabase, chuyển sang demo:", e);
        // Nạp dữ liệu demo ngay (demoMode vừa được setState).
        void demoLoad();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, loadAll, demoLoad]);

  // ═══════════════════════════════════════════════════════════
  //  Mở bài quiz
  //  - mode "review" / "kanji-review": cả thư viện (giữ limit từ prop count)
  //  - mode "daily" / "kanji-daily" : chỉ hôm nay
  //  - mode "lesson" / "kanji-lesson": chỉ trong bài lesson
  // ═══════════════════════════════════════════════════════════

  const beginQuiz = useCallback(
    async (mode: StudyMode, count?: number, lesson?: number) => {
      try {
        setFatalError(null);
        const today = todayVN();
        const isK = mode.startsWith("kanji");
        const isLesson = mode === "lesson" || mode === "kanji-lesson";
        const isReview = mode === "review" || mode === "kanji-review";

        let dailyItems: StudyItem[] = [];
        let pool: StudyItem[] = [];
        let source: StudyItem[] = [];

        if (demoMode) {
          pool = isK ? demoKanji() : demoVocab();
          dailyItems = pool.filter((i) => i.study_date === today);
          if (isLesson) {
            source = pool.filter((i) => i.lesson_number === lesson);
          } else {
            source = isReview ? pool : dailyItems;
          }
        } else {
          if (isLesson) {
            // Lesson mode: lấy chính xác từ bài đó, pool = tất cả để lấy đáp án sai
            const lessonItems = isK
              ? await getKanjiByLesson(lesson ?? 0)
              : await getVocabByLesson(lesson ?? 0);
            source = lessonItems as StudyItem[];
            pool = isK ? (kanji as StudyItem[]) : (vocab as StudyItem[]);
          } else {
            const fetched = isK
              ? [await getKanjiByDate(today), kanji]
              : [await getVocabByDate(today), vocab];
            dailyItems = fetched[0] as StudyItem[];
            pool = fetched[1] as StudyItem[];
            source = isReview ? pool : dailyItems;
          }
        }

        if (source.length === 0) {
          setFatalError(
            isLesson
              ? `Bài ${lesson ?? 0} chưa có ${isK ? "kanji" : "từ"} nào.`
              : isK
                ? "Chưa có kanji nào. Thêm kanji ở tab Học trước nhé."
                : "Chưa có từ nào. Thêm từ ở tab Học trước nhé.",
          );
          return;
        }

        const chosen: StudyItem[] = isReview
          ? sample(source, Math.min(count ?? source.length, source.length))
          : shuffle(source);

        const questions = buildQuiz(
          chosen,
          pool.length > 0 ? pool : chosen,
        );

        if (questions.length === 0) {
          setFatalError("Không dựng được câu hỏi. Thử lại với dữ liệu khác.");
          return;
        }

        const { id } = demoMode
          ? { id: `demo-session-${mode}-${lesson ?? today}` }
          : await startSession(mode, today);
        sessionIdRef.current = id;
        modeRef.current = mode;
        answerBuffer.current = [];
        setQuizQuestions(questions);

        const title = isLesson
          ? `Bài ${lesson} · ${questions.length} câu`
          : quizTitle(mode, questions.length);
        setScreen({ kind: "quiz", mode, title });
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : "Không tạo được bài học.");
      }
    },
    [kanji, vocab, demoMode],
  );

  // ═══════════════════════════════════════════════════════════
  //  Ghi kết quả
  // ═══════════════════════════════════════════════════════════

  const handleFinish = useCallback(async (result: QuizResult) => {
    const mode = modeRef.current;
    try {
      if (demoMode) {
        setDiamonds((d) => d + result.diamonds);
        setTodayCompleted((prev) => new Set(prev).add(mode));
        setScreen({ kind: "result", mode, result });
        return;
      }

      if (answerBuffer.current.length > 0) {
        await logAttempts(answerBuffer.current);
        answerBuffer.current = [];
      }

      await completeSession({
        sessionId: sessionIdRef.current,
        total: result.total,
        correct: result.correct,
        diamonds: result.diamonds,
      });

      // Cập nhật số dư + streak từ DB
      const state = await ensureAppState();
      setDiamonds(state.diamonds);
      setStreak(state.current_streak);
      setTodayCompleted((prev) => new Set(prev).add(mode));

      setScreen({ kind: "result", mode, result });
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : "Không lưu được kết quả.");
    }
  }, [demoMode]);

  // ═══════════════════════════════════════════════════════════
  //  Quay gacha
  // ═══════════════════════════════════════════════════════════

  const handleSpinDone = useCallback(
    async (kind: "reward" | "penalty") => {
      const tier = tierRef.current;
      if (!tier) return;
      const mode = modeRef.current;

      try {
        if (demoMode) {
          setDiamonds((d) =>
            kind === "penalty"
              ? Math.max(0, d - tier.amount)
              : d + tier.amount,
          );
          setTodaySpun((prev) => new Set(prev).add(`${mode}:${kind}`));
          return;
        }

        const res = await spinWheel({
          kind,
          mode,
          tierIndex: tier.tier_index,
          amount: tier.amount,
          reversed: kind === "penalty",
        });

        if (res.ok) {
          setDiamonds(res.diamonds ?? 0);
          setTodaySpun((prev) => new Set(prev).add(`${mode}:${kind}`));
        } else {
          setFatalError("Hôm nay bạn đã quay vòng này rồi.");
        }
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : "Không quay được vòng.");
      }
    },
    [demoMode],
  );

  const captureTier = useCallback((t: GachaTier) => {
    tierRef.current = t;
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════

  if (!configured) return <SetupScreen />;
  if (loading) return <LoadingScreen />;

  if (fatalError) {
    return (
      <div className="flex min-h-dvh flex-col justify-center">
        <ErrorNote message={fatalError} />
        <button
          onClick={() => {
            setFatalError(null);
            setLoading(true);
            loadAll()
              .catch((e) => setFatalError(e instanceof Error ? e.message : "Lỗi."))
              .finally(() => setLoading(false));
          }}
          className="btn btn-cyan mt-4 w-full py-3"
        >
          Thử lại
        </button>
        <button
          onClick={() => {
            setFatalError(null);
            setScreen({ kind: "tabs" });
          }}
          className="btn btn-ghost mt-2 w-full py-3"
        >
          Về trang chính
        </button>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <AnimatePresence mode="wait">
        {screen.kind === "quiz" && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <QuizPlayer
              key={`${screen.mode}-${quizQuestions.length}`}
              questions={quizQuestions}
              title={screen.title}
              onFinish={(r) => void handleFinish(r)}
              onExit={() => setScreen({ kind: "tabs" })}
              onAnswer={(a) => {
                answerBuffer.current.push({
                  ...a,
                  mode: modeRef.current.startsWith("kanji") ? "kanji" : "vocab",
                });
              }}
            />
          </motion.div>
        )}

        {screen.kind === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
          >
            <ResultScreen
              result={screen.result}
              tiers={tiers}
              rewardSpun={todaySpun.has(`${screen.mode}:reward`)}
              penaltySpun={todaySpun.has(`${screen.mode}:penalty`)}
              penaltyAvailable={missedDays > 0}
              streak={streak}
              onSpinDone={handleSpinDone}
              onTierRoll={captureTier}
              onRetry={() => void beginQuiz(screen.mode)}
              onHome={() => setScreen({ kind: "tabs" })}
            />
          </motion.div>
        )}

        {screen.kind === "rogue" && (
          <motion.div
            key="rogue"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
          >
            <RogueScreen
              mode={screen.mode}
              pool={screen.mode === "kanji" ? kanji : vocab}
              onExit={() => setScreen({ kind: "tabs" })}
              onFinish={(score) => {
                if (demoMode || score <= 0) return;
                void (async () => {
                  try {
                    const sb = getSupabase();
                    await sb.rpc("apply_wallet", {
                      p_app_id: APP_ID,
                      p_delta: score,
                    });
                    const state = await ensureAppState();
                    setDiamonds(state.diamonds);
                  } catch {
                    // bo qua loi thuong
                  }
                })();
              }}
            />
          </motion.div>
        )}

        {screen.kind === "tabs" && (
          <motion.div key="tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {tab === "home" && (
              <HomeTab
                diamonds={diamonds}
                streak={streak}
                vocabCount={vocab.length}
                kanjiCount={kanji.length}
                todayVocab={vocab.filter((v) => v.study_date === todayVN()).length}
                todayKanji={kanji.filter((k) => k.study_date === todayVN()).length}
                completed={todayCompleted}
                missedDays={missedDays}
                onStart={(mode) => void beginQuiz(mode)}
                onRogue={(m) => setScreen({ kind: "rogue", mode: m })}
                onOpenSettings={() => setTab("stats")}
              />
            )}

            {tab === "learn" && (
              <LearnTab
                onSaved={() => void loadAll()}
                vocabToday={vocab.filter((v) => v.study_date === todayVN())}
                kanjiToday={kanji.filter((k) => k.study_date === todayVN())}
                vocabLessons={vocabLessons}
                kanjiLessons={kanjiLessons}
                onDeleteVocab={async (id) => {
                  await deleteVocab(id);
                  await loadAll();
                }}
                onDeleteKanji={async (id) => {
                  await deleteKanji(id);
                  await loadAll();
                }}
              />
            )}

            {tab === "review" && (
              <ReviewTab
                vocabCount={vocab.length}
                kanjiCount={kanji.length}
                vocabLessons={vocabLessons}
                kanjiLessons={kanjiLessons}
                onStart={(mode, count, lesson) => void beginQuiz(mode, count, lesson)}
                onCreateLesson={async (kind, to) => {
                  if (demoMode) {
                    // Demo: gán bài cho item đầu tiên chưa có
                    const n = await bulkAssignLesson(kind, to);
                    return n;
                  }
                  const n = await bulkAssignLesson(kind, to);
                  await loadAll();
                  return n;
                }}
              />
            )}

            {tab === "kanji" && (
              <KanjiTab
                kanji={kanji}
                todayCount={kanji.filter((k) => k.study_date === todayVN()).length}
                completed={todayCompleted}
                onStart={(mode) => void beginQuiz(mode)}
              />
            )}

            {tab === "stats" && (
              <StatsTab
                diamonds={diamonds}
                streak={streak}
                calendar={calendar}
                vocabCount={vocab.length}
                kanjiCount={kanji.length}
                tiers={tiers}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {screen.kind === "tabs" && (
        <BottomNav tab={tab} onChange={setTab} />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function quizTitle(mode: StudyMode, n: number): string {
  const base =
    mode === "daily"
      ? "Học từ mới hôm nay"
      : mode === "review"
        ? "Ôn tập tổng hợp"
        : mode === "kanji-daily"
          ? "Học kanji hôm nay"
          : mode === "kanji-review"
            ? "Ôn tập kanji"
            : mode === "lesson"
              ? "Ôn tập từ vựng theo bài"
              : "Ôn tập kanji theo bài";
  return `${base} · ${n} câu`;
}