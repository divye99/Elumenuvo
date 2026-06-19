"use client";

import { motion } from "framer-motion";
import { ArrowDown, Zap } from "lucide-react";
import { SUPPLY_CHAIN, traditionalMarkup } from "@/lib/marketing/savings";

export function SupplyChainAnimation() {
  const markup = traditionalMarkup();
  // Running price index through the chain (base = 100).
  let running = 100;
  const layers = SUPPLY_CHAIN.map((l) => {
    running = running * (1 + l.margin);
    return { ...l, price: running };
  });

  return (
    <div className="grid items-stretch gap-6 md:grid-cols-2">
      {/* Traditional chain */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Traditional supply chain
        </div>
        <div className="mt-4 space-y-2">
          {layers.map((l, i) => (
            <div key={l.label}>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                className="flex items-center justify-between rounded-lg border bg-background px-4 py-2.5"
              >
                <span className="text-sm font-medium">{l.label}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {l.note}
                </span>
              </motion.div>
              {i < layers.length - 1 && (
                <div className="flex justify-center py-0.5 text-muted-foreground">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: layers.length * 0.15 }}
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-center"
        >
          <div className="text-xs text-muted-foreground">Buyer pays</div>
          <div className="text-2xl font-bold text-destructive tabular-nums">
            +{Math.round(markup * 100)}%
          </div>
          <div className="text-xs text-muted-foreground">over manufacturer price</div>
        </motion.div>
      </div>

      {/* With Elume */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/5 to-accent/5 p-6">
        <div className="text-sm font-semibold uppercase tracking-wide text-primary">
          With Elume
        </div>
        <div className="mt-4 flex h-[calc(100%-7rem)] flex-col items-center justify-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5"
          >
            <span className="text-sm font-medium">Manufacturer / Distributor</span>
          </motion.div>
          <div className="flex items-center gap-2 text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold">Elume — direct / near-direct</span>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5"
          >
            <span className="text-sm font-medium">You — contractor / developer</span>
          </motion.div>
        </div>
        <div className="mt-4 rounded-lg bg-success/10 px-4 py-3 text-center">
          <div className="text-xs text-muted-foreground">You save</div>
          <div className="text-2xl font-bold text-success tabular-nums">
            15–25%
          </div>
          <div className="text-xs text-muted-foreground">
            transparent pricing, no hidden layers
          </div>
        </div>
      </div>
    </div>
  );
}
