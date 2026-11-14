import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import type { CSSProperties, ReactNode, PointerEvent } from "react";
import { cx } from "./ui";

/** The Foreman mark: a column (the agent) carrying two arms (the work); the lower arm turns up into a tick (the proof). */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="fm-col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6e1e3e" /><stop offset="1" stopColor="#3a0c20" /></linearGradient>
        <linearGradient id="fm-a1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e2672f" /><stop offset="1" stopColor="#b33a12" /></linearGradient>
        <linearGradient id="fm-a2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#c47f12" /><stop offset="1" stopColor="#e8b444" /></linearGradient>
      </defs>
      <path d="M10 8h14l-4 48H6z" fill="url(#fm-col)" />
      <path d="M24 8h30c3 0 4 3 2 5l-6 7H22z" fill="url(#fm-a1)" />
      <path d="M21 31h16l6 6 12-14c2-2 5 0 4 3L45 46c-1 2-4 2-5 0l-5-6H20z" fill="url(#fm-a2)" />
    </svg>
  );
}

export function Wordmark({ className, silver, size = 22 }: { className?: string; silver?: boolean; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark size={size * 1.25} />
      <span className={cx("display", silver && "silver")} style={{ fontSize: size, lineHeight: 1 }}>Foreman</span>
    </span>
  );
}

/** Halftone orb; drift ties it to scroll. */
export function Orb({ color, size, style, y, rotate, className }: { color: string; size: number; style?: CSSProperties; y?: MotionValue<number>; rotate?: MotionValue<number>; className?: string }) {
  return <motion.div className={cx("orb", className)} style={{ width: size, height: size, ["--c" as any]: color, y, rotate, ...style }} />;
}

/** Corner labels from the printed sheet, bound to real values. */
export function Corner({ pos, children }: { pos: "tl" | "tr" | "bl" | "br"; children: ReactNode }) {
  const p = { tl: "left-5 top-24", tr: "right-5 top-24 text-right", bl: "left-5 bottom-5", br: "right-5 bottom-5 text-right" }[pos];
  return <div className={cx("pointer-events-none absolute z-10 font-mono text-[10.5px] uppercase leading-[1.35] tracking-[0.06em] text-ink/80", p)}>{children}</div>;
}

export const Cross = ({ className }: { className?: string }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" className={cx("absolute text-ink/50", className)} aria-hidden><path d="M5.5 0v11M0 5.5h11" stroke="currentColor" /></svg>
);

/** Liquid glass button: the specular highlight follows the pointer and the body leans slightly towards it. */
export function Glass({ children, href, onClick, ink, className, target }: { children: ReactNode; href?: string; onClick?: () => void; ink?: boolean; className?: string; target?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(useTransform(mx, (v) => v * 6), { stiffness: 300, damping: 20 });
  const y = useSpring(useTransform(my, (v) => v * 4), { stiffness: 300, damping: 20 });
  const move = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty("--mx", `${px * 100}%`);
    e.currentTarget.style.setProperty("--my", `${py * 100}%`);
    mx.set(px - 0.5); my.set(py - 0.5);
  };
  const leave = () => { mx.set(0); my.set(0); };
  const cls = cx("glass", ink && "glass-ink", className);
  return href ? (
    <motion.a href={href} target={target} rel={target ? "noreferrer" : undefined} className={cls} style={{ x, y }} onPointerMove={move} onPointerLeave={leave}>{children}</motion.a>
  ) : (
    <motion.button type="button" onClick={onClick} className={cls} style={{ x, y }} onPointerMove={move} onPointerLeave={leave}>{children}</motion.button>
  );
}
