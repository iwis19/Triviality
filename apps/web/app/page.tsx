"use client";
import dynamic from "next/dynamic";
const ExplorerApp = dynamic(() => import("./explore/ExplorerApp"), { ssr: false, loading: () => <div className="grid h-dvh place-items-center bg-[#fafaf8] text-sm text-black/40">Loading Triviality…</div> });
export default function Home() { return <ExplorerApp intro />; }
