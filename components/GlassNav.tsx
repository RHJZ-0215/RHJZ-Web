import React, { useCallback, useEffect, useRef } from 'react';
import {
  createGlassInstance,
  destroyGlassInstance,
  NAV_GLASS_OPTIONS,
  LENS_GLASS_OPTIONS,
} from '../utils/glass';

export interface NavItem {
  key: string;
  label: string;
  icon: string;
}

interface GlassNavProps {
  items: NavItem[];
  activeTab: string;
  onChange: (key: string) => void;
}

type Phase = 'idle' | 'fly' | 'fit' | 'drag';

// 弹簧参数：点击切换走"快速档"（扩张→滑到→收缩干脆利落，不拖沓）；拖拽松手走"弹性档"（弹性缓冲一次到位）
// 刚度取值保证显式积分稳定（ω·dt < 1）
const SPRING = {
  kxFast: 300, cxFast: 32,      // 点击滑动：快速、接近临界阻尼
  kxDrag: 150, cxDrag: 12,      // 拖拽松手：弹性缓冲（轻微过冲回弹）
  kwLift: 500, cwLift: 80,      // 快速扩张（轻微放大）
  kwFitFast: 550, cwFitFast: 58, // 点击收缩：快速
  kwFitDrag: 260, cwFitDrag: 22, // 拖拽收缩：弹性缓冲一次到位
};

const LIFT_W = 1.05;         // 拿起时宽度轻微放大（基于当前贴合尺寸，保持胶囊形态且不出框）
const LIFT_H = 1.12;         // 拿起时高度轻微放大

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function GlassNav({ items, activeTab, onChange }: GlassNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);
  const instRef = useRef<any>(null);
  const lensRef = useRef<any>(null);

  const mountedRef = useRef(false);
  const skipAnimRef = useRef(false); // 拖拽松手已直接贴合 → 跳过 React effect 触发的动画

  // 动画状态机（ref 存储，逐帧驱动 DOM，不触发 React 渲染）
  const sim = useRef({
    raf: 0,
    running: false,
    last: 0,
    x: 0, vx: 0,              // 球心（相对 nav padding box，像素）
    y: 0,
    w: 0, h: 0, vw: 0, vh: 0, // 球宽/高（均由弹簧驱动，始终保持胶囊形态）
    phase: 'idle' as Phase,
    targetX: 0,               // 飞行目标中心
    btnW: 0, btnH: 0,         // 贴合尺寸
    liftW: 0, liftH: 0,       // 拿起（放大）尺寸
    tw: 0, th: 0,             // 当前宽/高弹簧目标
    dragging: false,
    pointerId: -1,
    prevPointerT: 0,
    dragVx: 0,                // 拖拽瞬时速度（驱动小幅度弹性收缩）
    fromDrag: false,          // 当前 fit 来源：拖拽松手（弹性缓冲）或点击（快速）
    lastLensX: 0, lastLensY: 0, lastLensT: 0,
  });

  const getButtonRect = useCallback(
    (key: string) => {
      const nav = navRef.current;
      if (!nav) return null;
      const btn = nav.querySelector<HTMLElement>(`.nav-btn[data-key="${key}"]`);
      if (!btn) return null;
      return { x: btn.offsetLeft + btn.offsetWidth / 2, y: btn.offsetTop + btn.offsetHeight / 2, w: btn.offsetWidth, h: btn.offsetHeight };
    },
    [],
  );

  const paint = useCallback(() => {
    const s = sim.current;
    const ball = ballRef.current;
    if (!ball) return;
    // 移动中仅小幅度弹性收缩（保持胶囊形态，不做圆球/大椭圆）
    let stretch = 0;
    if (s.phase === 'fly' || s.phase === 'drag') {
      const v = s.phase === 'drag' ? s.dragVx : s.vx;
      stretch = clamp(v * 0.0012, -0.06, 0.06);
    }
    ball.style.width = `${s.w}px`;
    ball.style.height = `${s.h}px`;
    ball.style.transform = `translate(${s.x - s.w / 2}px, ${s.y - s.h / 2}px) scale(${1 + stretch}, ${1 - stretch * 0.55})`;
    // 贴合胶囊时球浮于按钮之上（可被按下抓起拖拽），并隐藏透镜层让文字清晰可见；动画中让位不挡按钮点击
    ball.classList.toggle('over', s.phase === 'idle');
    ball.classList.toggle('settled', s.phase === 'idle');
    ball.classList.toggle('dragging', s.dragging);
    // 注意：透镜 refresh 仅在拖拽 pointermove 中触发，避免同步重绘阻塞动画帧
  }, []);

  const stopLoop = useCallback(() => {
    const s = sim.current;
    s.running = false;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  }, []);

  const step = useCallback(
    (dt: number) => {
      const s = sim.current;
      // 水平滑动（点击：立刻移动并并行放大；拖拽松手：弹性缓冲一次到位）
      if (s.phase === 'fly' || s.phase === 'fit') {
        const kx = s.fromDrag ? SPRING.kxDrag : SPRING.kxFast;
        const cx = s.fromDrag ? SPRING.cxDrag : SPRING.cxFast;
        const ax = kx * (s.targetX - s.x) - cx * s.vx;
        s.vx += ax * dt;
        s.x += s.vx * dt;
        if (s.phase === 'fly') {
          // 移动中并行放大（快速扩张，点击后立刻滑动，不等待）
          const aw = SPRING.kwLift * (s.tw - s.w) - SPRING.cwLift * s.vw;
          s.vw += aw * dt;
          s.w += s.vw * dt;
          const ah = SPRING.kwLift * (s.th - s.h) - SPRING.cwLift * s.vh;
          s.vh += ah * dt;
          s.h += s.vh * dt;
          // 接近目标即开始收缩（移动与收缩并行，避免"先停稳再收缩"两步）
          if (Math.abs(s.targetX - s.x) < 30) {
            s.phase = 'fit';
            s.tw = s.btnW;
            s.th = s.btnH;
          }
        } else if (Math.abs(s.vx) < 0.8 && Math.abs(s.targetX - s.x) < 1.5) {
          s.x = s.targetX;
          s.vx = 0;
        }
      }
      // 尺寸收缩（仅 fit 阶段：弹性缓冲一次到位）
      if (s.phase === 'fit') {
        const kw = s.fromDrag ? SPRING.kwFitDrag : SPRING.kwFitFast;
        const cw = s.fromDrag ? SPRING.cwFitDrag : SPRING.cwFitFast;
        const aw = kw * (s.tw - s.w) - cw * s.vw;
        s.vw += aw * dt;
        s.w += s.vw * dt;
        const ah = kw * (s.th - s.h) - cw * s.vh;
        s.vh += ah * dt;
        s.h += s.vh * dt;
        if (
          Math.abs(s.w - s.tw) < 1.0 && Math.abs(s.h - s.th) < 1.0 &&
          Math.abs(s.vw) < 1.2 && Math.abs(s.vh) < 1.2 &&
          Math.abs(s.x - s.targetX) < 1.5 && Math.abs(s.vx) < 0.8
        ) {
          s.w = s.tw;
          s.h = s.th;
          s.vw = 0;
          s.vh = 0;
          s.phase = 'idle';
          stopLoop();
        }
      }
      paint();
    },
    [paint, stopLoop],
  );

  const ensureLoop = useCallback(() => {
    const s = sim.current;
    if (s.running) return;
    s.running = true;
    s.last = performance.now();
    const tick = (now: number) => {
      const ss = sim.current;
      const dt = Math.min((now - ss.last) / 1000, 0.02);
      ss.last = now;
      step(dt);
      if (ss.running) ss.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }, [step]);

  /** 动画到目标标签：拿起（按当前尺寸轻微放大，保持胶囊形态）→ 弹性移动 → 缩小贴合 */
  const animateTo = useCallback(
    (key: string) => {
      const rect = getButtonRect(key);
      const s = sim.current;
      if (!rect) return;
      // 拖拽松手已启动弹性贴合：不再播放新动画
      if (skipAnimRef.current) {
        skipAnimRef.current = false;
        return;
      }
      s.btnW = rect.w;
      s.btnH = rect.h;
      s.liftW = s.w * LIFT_W;
      s.liftH = s.h * LIFT_H;
      s.targetX = rect.x;
      s.y = rect.y;
      s.fromDrag = false; // 点击路径：快速档
      if (s.phase === 'idle' || s.phase === 'drag') {
        // 点击：立刻水平移动，移动中并行轻微放大（不等待）
        s.tw = s.liftW;
        s.th = s.liftH;
        s.phase = 'fly';
      } else {
        // 动画进行中被再次点击：从当前状态直接飞向新目标
        s.phase = 'fly';
      }
      ensureLoop();
    },
    [getButtonRect, ensureLoop],
  );

  // 激活标签变化 → 动画（首次挂载直接吸附，不播放）
  useEffect(() => {
    const rect = getButtonRect(activeTab);
    if (!rect) return;
    if (!mountedRef.current) {
      const s = sim.current;
      s.x = rect.x;
      s.y = rect.y;
      s.w = rect.w;
      s.h = rect.h;
      s.btnW = rect.w;
      s.btnH = rect.h;
      s.liftW = rect.w * LIFT_W;
      s.liftH = rect.h * LIFT_H;
      s.phase = 'idle';
      mountedRef.current = true;
      paint();
      return;
    }
    animateTo(activeTab);
  }, [activeTab, getButtonRect, animateTo, paint]);

  // 窗口尺寸变化：idle 时重新吸附
  useEffect(() => {
    const onResize = () => {
      const s = sim.current;
      if (s.phase === 'idle') {
        const rect = getButtonRect(activeTab);
        if (rect) {
          s.x = rect.x;
          s.y = rect.y;
          s.w = rect.w;
          s.h = rect.h;
          s.btnW = rect.w;
          s.btnH = rect.h;
          paint();
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeTab, getButtonRect, paint]);

  // 导航胶囊自身的 WebGL 液态玻璃
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const inst = await createGlassInstance(navRef.current as HTMLElement, NAV_GLASS_OPTIONS);
      if (cancelled) {
        destroyGlassInstance(inst);
        return;
      }
      instRef.current = inst;
    })();
    return () => {
      cancelled = true;
      destroyGlassInstance(instRef.current);
      instRef.current = null;
      stopLoop();
    };
  }, [stopLoop]);

  // 高亮球 = 完全透明折射透镜（球下内容自然轻微放大）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lens = await createGlassInstance(ballRef.current as HTMLElement, LENS_GLASS_OPTIONS);
      if (cancelled) {
        destroyGlassInstance(lens);
        return;
      }
      lensRef.current = lens;
      paint();
    })();
    return () => {
      cancelled = true;
      destroyGlassInstance(lensRef.current);
      lensRef.current = null;
    };
  }, [paint]);

  // ── 拖拽交互：按下当前标签 → 胶囊轻微放大出现 → 随鼠标框内平滑移动 ──
  const onBallPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    const s = sim.current;
    const nav = navRef.current;
    if (!nav) return;
    s.dragging = true;
    s.pointerId = e.pointerId;
    s.phase = 'drag';
    // 先轻微放大（保持大致形态不变）
    const cur = getButtonRect(activeTab);
    s.liftW = (cur?.w ?? s.w) * LIFT_W;
    s.liftH = (cur?.h ?? s.h) * LIFT_H;
    s.tw = s.liftW;
    s.th = s.liftH;
    s.w = s.liftW;
    s.h = s.liftH;
    s.prevPointerT = performance.now();
    s.dragVx = 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件或无 active pointer 时忽略 */
    }
    stopLoop();
    paint();
  };

  const onBallPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const s = sim.current;
    const nav = navRef.current;
    if (!s.dragging || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const now = performance.now();
    const dt = Math.max(now - s.prevPointerT, 4) / 1000;
    // 限制在导航胶囊框内滑动：允许轻微溢出（≤16px），但不彻底出框
    const target = clamp(e.clientX - navRect.left, s.w / 2 - 16, navRect.width - s.w / 2 + 16);
    s.dragVx = dt > 0 ? (target - s.x) / dt : 0;
    s.vx = s.dragVx;
    s.x = target;
    s.prevPointerT = now;
    // 透镜跟随球体（节流 ≤80ms，同步重绘开销大）
    if (now - s.lastLensT > 80) {
      s.lastLensT = now;
      if (lensRef.current && lensRef.current.refresh) {
        lensRef.current.refresh();
      }
    }
    paint();
  };

  const endDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    // 吸附最近标签
    let nearest: string | null = null;
    let best = Infinity;
    for (const item of items) {
      const rect = getButtonRect(item.key);
      if (!rect) continue;
      const d = Math.abs(rect.x - s.x);
      if (d < best) {
        best = d;
        nearest = item.key;
      }
    }
    const target = nearest ?? activeTab;
    const rect = getButtonRect(target);
    // 松手：弹性缓冲一次性贴合（水平与收缩并行，不瞬移、不分两步）
    if (rect) {
      s.fromDrag = true; // 拖拽路径：弹性缓冲档
      s.targetX = rect.x;
      s.btnW = rect.w;
      s.btnH = rect.h;
      s.tw = rect.w;
      s.th = rect.h;
      s.phase = 'fit';
      ensureLoop();
      paint();
    }
    if (target !== activeTab) {
      skipAnimRef.current = true;
      onChange(target);
    }
  };

  return (
    <nav className="main-nav" ref={navRef}>
      <span
        className="nav-ball"
        ref={ballRef}
        aria-hidden="true"
        onPointerDown={onBallPointerDown}
        onPointerMove={onBallPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      {items.map((item) => (
        <button
          key={item.key}
          data-key={item.key}
          className={`nav-btn ${activeTab === item.key ? 'active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          <i className={item.icon}></i>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
