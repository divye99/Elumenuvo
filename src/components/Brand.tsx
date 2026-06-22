/* eslint-disable @next/next/no-img-element */
// Logo lockups. Plain <img> (not next/image) to match the prototype's exact
// height-driven sizing with transparent PNGs.

export function Mark({ height = 30 }: { height?: number }) {
  return <img src="/assets/elume-mark.png" alt="Elume" style={{ height, width: "auto", display: "block" }} />;
}

export function Wordmark({ height = 17, white = false, opacity }: { height?: number; white?: boolean; opacity?: number }) {
  return (
    <img
      src={white ? "/assets/elume-wordmark-white.png" : "/assets/elume-wordmark.png"}
      alt="elume"
      style={{ height, width: "auto", display: "block", opacity }}
    />
  );
}
