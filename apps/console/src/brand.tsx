import { motion } from "framer-motion";
import type { MotionValue } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { Bolt } from "./art";
import { cx } from "./ui";

/** The Foreman mark: a black lightning bolt. */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return <Bolt color="#0e0e0e" className={className} style={{ width: size, height: size }} />;
}

/** "⚡ Foreman": black bolt + heavy tight sans. `silver` is kept for old call sites and ignored. */
export function Wordmark({ className, size = 22 }: { className?: string; silver?: boolean; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-ink", className)}>
      <Mark size={size * 1.15} className="-rotate-6" />
      <span className="font-sans font-extrabold tracking-[-0.03em]" style={{ fontSize: size, lineHeight: 1 }}>Foreman</span>
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

/** Brand button: a `.brut` sticker link or button. `ink` = black, otherwise paper. */
export function Glass({ children, href, onClick, ink, className, target }: { children: ReactNode; href?: string; onClick?: () => void; ink?: boolean; className?: string; target?: string }) {
  const cls = cx("brut", !ink && "brut-light", className);
  return href ? (
    <a href={href} target={target} rel={target ? "noreferrer" : undefined} className={cls}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{children}</button>
  );
}
