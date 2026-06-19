"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { computeSavings, SAVINGS_LOW, SAVINGS_HIGH } from "@/lib/marketing/savings";
import { formatINR, formatINRCompact } from "@/lib/utils";

const PRESETS = [500000, 1000000, 1500000, 3000000];

export function SavingsCalculator() {
  const [spend, setSpend] = useState(1000000);
  const s = useMemo(() => computeSavings(spend), [spend]);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">
        Savings calculator
      </div>
      <h3 className="mt-1 text-xl font-bold tracking-tight">
        What does the middle-man layer cost you?
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your monthly electrical procurement spend.
      </p>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium text-muted-foreground">Monthly spend</label>
          <span className="text-lg font-bold tabular-nums">{formatINR(spend)}</span>
        </div>
        <input
          type="range"
          min={100000}
          max={5000000}
          step={50000}
          value={spend}
          onChange={(e) => setSpend(Number(e.target.value))}
          className="mt-2 w-full accent-[hsl(var(--primary))]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setSpend(p)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                spend === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {formatINRCompact(p)}/mo
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={s.annualMid}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-6 rounded-xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground"
      >
        <div className="text-sm opacity-90">Estimated annual saving with Elume</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
          {formatINRCompact(s.annualMid)}
        </div>
        <div className="mt-1 text-sm opacity-90">
          Range {formatINRCompact(s.annualLow)}–{formatINRCompact(s.annualHigh)} /yr ·{" "}
          {Math.round(SAVINGS_LOW * 100)}–{Math.round(SAVINGS_HIGH * 100)}% vs the traditional chain
        </div>
      </motion.div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Indicative, based on the 4–5 layer distribution margins described in our market research.
        Actual savings vary by SKU, volume, and credit terms.
      </p>
    </div>
  );
}
