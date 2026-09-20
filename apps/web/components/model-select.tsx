"use client";

import { useId, useState } from "react";
import { Select } from "@base-ui/react/select";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { modelCatalog } from "@/lib/research-store";

const brands: Record<string, { name: string; logo: string; maskColor?: string }> = {
  // Color variants from the public AI Icons repository; OpenAI's currentColor mark is tinted with its brand purple.
  openai: { name: "OpenAI", logo: "https://raw.githubusercontent.com/gokuscraper/ai-icons/main/svgs/openai.svg", maskColor: "#412991" },
  gemini: { name: "Google", logo: "https://raw.githubusercontent.com/gokuscraper/ai-icons/main/svgs/gemini-color.svg" },
  deepseek: { name: "DeepSeek", logo: "https://raw.githubusercontent.com/gokuscraper/ai-icons/main/svgs/deepseek-color.svg" },
  qwen: { name: "Alibaba", logo: "https://raw.githubusercontent.com/gokuscraper/ai-icons/main/svgs/qwen-color.svg" },
  devin: { name: "Devin", logo: "https://raw.githubusercontent.com/gokuscraper/ai-icons/main/svgs/devin-color.svg" },
};

function ProviderLogo({ provider }: { provider: string }) {
  const [failed, setFailed] = useState(false);
  const brand = brands[provider];
  return <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-white">
    {failed || !brand ? <span className="text-xs font-semibold">{brand?.name.slice(0, 1) ?? "M"}</span> : brand.maskColor ?
      <span
        className="h-5 w-5"
        style={{
          backgroundColor: brand.maskColor,
          maskImage: `url(${brand.logo})`,
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: `url(${brand.logo})`,
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      /> :
      // Provider brand assets; fall back to an initial if the image is unavailable.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logo} alt="" className="h-5 w-5 object-contain" onError={() => setFailed(true)} />}
  </span>;
}

export function ModelLabel({ id, fallbackLabel = "Choose a model" }: { id: string; fallbackLabel?: string }) {
  const model = modelCatalog.models.find((item) => item.id === id);
  if (!model) return <span>{fallbackLabel}</span>;
  const name = model.label.split(/\s+[·/]\s+/).slice(1).join(" ") || model.label;
  return <span className="flex min-w-0 items-center gap-3">
    <ProviderLogo key={model.provider} provider={model.provider} />
    <span className="min-w-0 text-left"><span className="block truncate text-sm font-medium text-black/85">{name}</span><span className="block text-[11px] font-normal text-black/45">{brands[model.provider]?.name}{model.provider === "devin" ? " · Agent service" : ""}</span></span>
  </span>;
}

export function ModelSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const labelId = useId();
  return <div className="grid gap-1.5">
    <span id={labelId} className="text-sm font-medium">{label}</span>
    <Select.Root value={value} onValueChange={(next) => { if (next) onChange(next); }} items={modelCatalog.models.map((model) => ({ value: model.id, label: model.label }))}>
      <Select.Trigger aria-labelledby={labelId} className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-black/12 bg-white px-3 py-2 text-left outline-none transition hover:border-black/30 hover:bg-black/[0.015] focus-visible:ring-2 focus-visible:ring-black/30 data-popup-open:border-black/35">
        <Select.Value className="min-w-0"><ModelLabel id={value} /></Select.Value>
        <Select.Icon><IconChevronDown size={16} className="shrink-0 text-black/40 transition-transform group-data-popup-open:rotate-180" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} className="z-[70]">
          <Select.Popup className="w-[var(--anchor-width)] min-w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xl shadow-black/10 outline-none">
            <Select.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto">
              {modelCatalog.models.map((model) => <Select.Item key={model.id} value={model.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 outline-none data-highlighted:bg-black/5 data-selected:bg-black/[0.035]">
                <Select.ItemText><ModelLabel id={model.id} /></Select.ItemText>
                <Select.ItemIndicator className="text-black/70"><IconCheck size={16} /></Select.ItemIndicator>
              </Select.Item>)}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>;
}
