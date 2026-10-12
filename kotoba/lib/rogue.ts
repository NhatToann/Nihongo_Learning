// ═══════════════════════════════════════════════════════════════
//  Rogue-lite: sinh bản đồ node cho một lượt chơi
//  Tham khảo Slay the Web (AGPL) — chỉ lấy cảm hứng về cấu trúc
//  map dạng nhánh với node đa loại.
// ═══════════════════════════════════════════════════════════════

export type NodeKind =
  | "battle" // hỏi 3 câu, sai 1 lần mất 1 HP
  | "elite" // hỏi 4 câu, sai 2 lần mất 1 HP, thưởng gấp đôi
  | "rest" // hồi 1 HP, không có câu hỏi
  | "shop" // đổi diamond lấy combo shield
  | "boss"; // node cuối, hỏi 6 câu, thắng = hoàn thành run

export interface MapNode {
  id: string;
  kind: NodeKind;
  /** Cột dọc (0 = trên cùng) */
  row: number;
  /** Cột ngang trong hàng */
  col: number;
  /** Các node có thể đi tới từ node này */
  next: string[];
  /** Câu hỏi cần trả lời */
  questions: number;
}

export interface RunState {
  seed: number;
  floor: number;
  hp: number;
  maxHp: number;
  diamonds: number;
  /** Node hiện tại đang đứng */
  currentNodeId: string | null;
  /** Các node đã đi qua */
  visited: string[];
  /** Node đã mở khóa nhưng chưa đi */
  available: string[];
  won: boolean;
  dead: boolean;
}

export const RUN_CONFIG = {
  rows: 8,
  maxHp: 3,
  hpPerRest: 1,
  eliteBonus: 2,
  shopCost: 500,
} as const;

// ── Sinh bản đồ ────────────────────────────────────────────────

/**
 * Sinh bản đồ ngẫu nhiên có cấu trúc nhánh:
 * mỗi node kết nối tới 1-2 node ở hàng kế tiếp.
 * Hàng cuối luôn là boss.
 */
export function generateMap(
  seed: number,
  rows: number = RUN_CONFIG.rows,
): MapNode[] {
  const rng = mulberry32(seed);
  const nodes: MapNode[] = [];

  // Số node mỗi hàng: hàng đầu 2, hàng giữa 2-3, hàng cuối 1 (boss)
  const colsPerRow: number[] = [];
  for (let r = 0; r < rows; r++) {
    if (r === 0) colsPerRow.push(2);
    else if (r === rows - 1) colsPerRow.push(1);
    else colsPerRow.push(rng() < 0.5 ? 2 : 3);
  }

  // Sinh node từng hàng
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < colsPerRow[r]; c++) {
      const kind: NodeKind =
        r === 0
          ? "battle"
          : r === rows - 1
            ? "boss"
            : r === rows - 2
              ? rng() < 0.4
                ? "rest"
                : "elite"
              : pickKind(rng);

      nodes.push({
        id: `n${r}-${c}`,
        kind,
        row: r,
        col: c,
        next: [],
        questions:
          kind === "boss" ? 6 : kind === "elite" ? 4 : kind === "battle" ? 3 : 0,
      });
    }
  }

  // Nối các hàng
  for (let r = 0; r < rows - 1; r++) {
    const current = nodes.filter((n) => n.row === r);
    const nextRow = nodes.filter((n) => n.row === r + 1);

    for (const node of current) {
      // Mỗi node nối tới 1 node ở hàng sau (theo tỉ lệ vị trí)
      const targetCol = nextRow.length === 1 ? 0 : node.col % nextRow.length;
      node.next.push(nextRow[targetCol].id);

      // 40% khả năng có đường nhánh phụ
      if (nextRow.length > 1 && rng() < 0.4) {
        const altCol = (targetCol + 1 + Math.floor(rng() * (nextRow.length - 1))) % nextRow.length;
        const altId = nextRow[altCol].id;
        if (altId !== node.next[0]) node.next.push(altId);
      }
    }

    // Đảm bảo mọi node ở hàng sau đều có ít nhất 1 node cha
    for (const target of nextRow) {
      const hasParent = current.some((n) => n.next.includes(target.id));
      if (!hasParent) {
        const parent = current[Math.floor(rng() * current.length)];
        parent.next.push(target.id);
      }
    }
  }

  return nodes;
}

function pickKind(rng: () => number): NodeKind {
  const roll = rng();
  if (roll < 0.5) return "battle";
  if (roll < 0.72) return "elite";
  if (roll < 0.88) return "rest";
  return "shop";
}

// ── State helpers ───────────────────────────────────────────────

export function createRun(seed = Date.now() % 2 ** 31): RunState {
  const map = generateMap(seed);
  const firstNodes = map.filter((n) => n.row === 0).map((n) => n.id);

  return {
    seed,
    floor: 1,
    hp: RUN_CONFIG.maxHp,
    maxHp: RUN_CONFIG.maxHp,
    diamonds: 0,
    currentNodeId: null,
    visited: [],
    available: firstNodes,
    won: false,
    dead: false,
  };
}

/** Node hiện tại theo id */
export function getNode(map: MapNode[], id: string | null): MapNode | null {
  if (!id) return null;
  return map.find((n) => n.id === id) ?? null;
}

/** Đi tới node mới sau khi thắng node hiện tại */
export function advance(
  map: MapNode[],
  state: RunState,
  nextId: string,
): RunState {
  const node = getNode(map, state.currentNodeId);
  return {
    ...state,
    currentNodeId: nextId,
    visited: [...state.visited, nextId],
    available: node ? node.next : state.available,
    hp: Math.max(0, state.hp),
    floor: state.floor + 1,
  };
}

/** Kết thúc run khi thắng boss */
export function winRun(state: RunState): RunState {
  return { ...state, won: true };
}

export function loseHp(state: RunState, amount = 1): RunState {
  const hp = Math.max(0, state.hp - amount);
  return { ...state, hp, dead: hp === 0 };
}

export function heal(state: RunState, amount = RUN_CONFIG.hpPerRest): RunState {
  return {
    ...state,
    hp: Math.min(state.maxHp, state.hp + amount),
  };
}

export function addDiamonds(state: RunState, amount: number): RunState {
  return { ...state, diamonds: state.diamonds + amount };
}

/** Điểm cuối run = diamond thu được × (HP còn lại ×2) */
export function runScore(state: RunState): number {
  return state.diamonds + state.hp * 200 + (state.won ? 1000 : 0);
}

// ── Hằng số hiển thị ────────────────────────────────────────────

export const NODE_META: Record<
  NodeKind,
  { icon: string; label: string; color: string }
> = {
  battle: { icon: "⚔️", label: "Trận thường", color: "#4FF0C6" },
  elite: { icon: "💀", label: "Trận tinh", color: "#C05CFF" },
  rest: { icon: "🍙", label: "Nghỉ ngơi", color: "#8AF7A6" },
  shop: { icon: "🏪", label: "Cửa hàng", color: "#F8F971" },
  boss: { icon: "👑", label: "BOSS", color: "#FF4D9D" },
};

// ── PRNG deterministic ──────────────────────────────────────────

/** Mulberry32: nhanh, tốt cho game */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}