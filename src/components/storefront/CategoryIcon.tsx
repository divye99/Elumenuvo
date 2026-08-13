/**
 * Elume category icon system (design pass, Aug 2026). Replaces the emoji
 * category navigation with a coherent set of technical line icons - the kind
 * of restrained mark an electrical-procurement product warrants.
 *
 * Rules: 24x24 viewBox, 1.7px stroke, round joins, currentColor only (the
 * consumer sets colour and size). No fills except deliberate small accents.
 * One icon per catalogue category; `dot` is the neutral fallback.
 */
import React from "react";

type P = { size?: number; className?: string; strokeWidth?: number };

const base = (size: number, children: React.ReactNode, strokeWidth = 1.7, className?: string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** Wire coil: circle of cable with a lead-out tail. */
const Wires = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <circle cx="11" cy="12" r="6.5" />
    <circle cx="11" cy="12" r="2.8" />
    <path d="M17.2 14.5 21 18" />
  </>, strokeWidth, className);

/** MCB: DIN breaker outline with toggle lever. */
const Switchgear = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="7" y="3.5" width="10" height="17" rx="1" />
    <path d="M10.5 8.5h3v4h-3z" />
    <path d="M12 12.5v3.5" />
    <path d="M9.5 3.5v-1.5M14.5 3.5v-1.5M9.5 22v-1.5M14.5 22v-1.5" />
  </>, strokeWidth, className);

/** Modular switch plate: faceplate with rocker. */
const Modular = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <rect x="9.5" y="8" width="5" height="8" rx="0.8" />
    <path d="M12 8v4" />
  </>, strokeWidth, className);

/** Bulb with filament base. */
const Lighting = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <path d="M12 3a6 6 0 0 1 3.6 10.8c-.9.7-1.1 1.4-1.1 2.2h-5c0-.8-.2-1.5-1.1-2.2A6 6 0 0 1 12 3Z" />
    <path d="M10 19h4M10.8 21.5h2.4" />
  </>, strokeWidth, className);

/** Ceiling fan: hub and three blades. */
const Fans = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M14 10.6c1.4-1.4 5-2.6 6.5-1.2 1 1-.3 2.6-2.5 2.6H14" />
    <path d="M10.6 10C9.2 8.6 8 5 9.4 3.5c1-1 2.6.3 2.6 2.5V10" />
    <path d="M10 13.4c-1.4 1.4-5 2.6-6.5 1.2-1-1 .3-2.6 2.5-2.6H10" />
    <path d="M13.4 14c1.4 1.4 2.6 5 1.2 6.5-1 1-2.6-.3-2.6-2.5V14" />
  </>, strokeWidth, className);

/** Storage geyser: tank, inlet/outlet, drop. */
const WaterHeaters = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="7" y="3" width="10" height="14" rx="3" />
    <path d="M9.5 17v3M14.5 17v3" />
    <path d="M12 7.2s-1.8 1.9-1.8 3a1.8 1.8 0 0 0 3.6 0c0-1.1-1.8-3-1.8-3Z" />
  </>, strokeWidth, className);

/** Distribution board: enclosure with breaker ways. */
const Panels = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
    <path d="M4 9.5h16" />
    <path d="M8 12.5v4M12 12.5v4M16 12.5v4" />
    <path d="M7 7h4" />
  </>, strokeWidth, className);

/** Monoblock pump: volute + outlet + base. */
const Pumps = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <circle cx="11" cy="11.5" r="5.5" />
    <circle cx="11" cy="11.5" r="1.6" />
    <path d="M16.5 9H20V6.5" />
    <path d="M6.5 20h9M8.5 17l-1 3M13.5 17l1 3" />
  </>, strokeWidth, className);

/** 3-pin plug (Indian): earth on top. */
const Accessories = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 6.4v2.8" strokeWidth={2.4} />
    <path d="M8.6 13.2v2.8M15.4 13.2v2.8" strokeWidth={2.4} />
  </>, strokeWidth, className);

/** EV charging: charger outline with bolt. */
const Ev = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="6" y="3.5" width="12" height="17" rx="1.5" />
    <path d="M13.2 7 10 12.4h4L10.8 17.8" />
  </>, strokeWidth, className);

/** Power strip: board with sockets. */
const ExtBoards = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <rect x="3" y="8" width="18" height="8" rx="1.5" />
    <circle cx="8" cy="12" r="1.3" />
    <circle cx="13" cy="12" r="1.3" />
    <path d="M17.5 10.7v2.6" />
  </>, strokeWidth, className);

/** Copper: stacked ingots. */
const Copper = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <>
    <path d="M4 15h7l2 4H2l2-4ZM13 15h7l2 4H11M8.5 11h7l2 4M12 7h7l2 4" />
  </>, strokeWidth, className);

const Dot = ({ size = 20, strokeWidth, className }: P) =>
  base(size, <circle cx="12" cy="12" r="3" />, strokeWidth, className);

const MAP: Record<string, (p: P) => React.ReactElement> = {
  "Wires & Cables": Wires,
  Switchgear: Switchgear,
  Modular: Modular,
  Lighting: Lighting,
  Fans: Fans,
  "Water Heaters": WaterHeaters,
  "DB & Panels": Panels,
  Pumps: Pumps,
  "Electrical Accessories": Accessories,
  "EV Charging": Ev,
  "Extension Boards": ExtBoards,
  Copper: Copper,
};

/** The category icon, or a neutral dot for anything unmapped. */
export default function CategoryIcon({ cat, size = 20, strokeWidth, className }: { cat: string } & P) {
  const Icon = MAP[cat] ?? Dot;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
