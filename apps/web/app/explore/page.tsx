"use client";

import dynamic from "next/dynamic";

const ExplorerApp = dynamic(() => import("./ExplorerApp"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100dvh", background: "#0b1020", color: "#9aa5bd" }}>
      Loading explorer…
    </div>
  ),
});

export default function ExplorePage() {
  return <ExplorerApp />;
}
