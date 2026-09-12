import { cn } from "@/lib/utils";
import { Activity, AppWindow, BarChart3, Boxes, BrainCircuit, KeyRound, LayoutDashboard, Menu, Settings2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

const items = [
  { label: "Overview", icon: LayoutDashboard, path: "/" },
  { label: "Applications", icon: AppWindow, path: "/applications" },
  { label: "Databases", icon: Boxes, path: "/databases" },
  { label: "Statistics", icon: BarChart3, path: "/statistics" },
  { label: "Activity", icon: Activity, path: "/activity" },
  { label: "AI Support", icon: BrainCircuit, path: "/ai-support" },
  { label: "API Keys", icon: KeyRound, path: "/api-keys" },
  { label: "Settings", icon: Settings2, path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const active = items.find(item => location === item.path) ?? items[0];
  return <div className="min-h-screen bg-[#0b0d10] text-slate-200 lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="hidden border-r border-slate-800/80 bg-[#0e1115] lg:flex lg:flex-col">
      <div className="flex h-[76px] items-center gap-3 border-b border-slate-800/80 px-6"><div className="grid h-9 w-9 place-items-center bg-[#ef6c35] text-[#11151a]"><ShieldCheck size={19} /></div><div><div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-100">Firebox</div><div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Control Room</div></div></div>
      <nav className="flex-1 px-3 py-6"><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Workspace</div>{items.map(item => <button key={item.path} onClick={() => setLocation(item.path)} className={cn("mb-1 flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left text-sm transition-colors", location === item.path ? "border-[#ef6c35] bg-[#171b20] text-white" : "border-transparent text-slate-500 hover:bg-[#14181d] hover:text-slate-200")}><item.icon size={16} strokeWidth={1.8} /><span>{item.label}</span></button>)}</nav>
      <div className="border-t border-slate-800/80 p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" />System operational</div></div>
    </aside>
    <main className="min-w-0"><header className="flex min-h-[76px] items-center justify-between border-b border-slate-800/80 bg-[#0e1115] px-5 sm:px-8"><div className="flex items-center gap-3"><button className="text-slate-500 lg:hidden"><Menu size={20} /></button><div><div className="text-sm font-medium text-slate-100">{active?.label ?? "Overview"}</div><div className="text-xs text-slate-600">Firebox ecosystem / control room</div></div></div><div className="flex items-center gap-4"><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" />Online</div><div className="border-l border-slate-800 pl-4 text-right"><div className="text-xs font-medium text-slate-200">Administrator</div><div className="text-[10px] text-slate-600">Local access</div></div></div></header><div className="p-5 sm:p-8">{children}</div></main>
  </div>;
}
