"use client";

import dynamic from "next/dynamic";

const ExplorerApp = dynamic(() => import("./ExplorerApp"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100dvh", background: "#fafaf8", color: "#777" }}>
      Loading explorer…
    </div>
  ),
});

export default function ExplorePage() {
  return <ExplorerApp />;
}
