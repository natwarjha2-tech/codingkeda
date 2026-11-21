"use client";
import { DIFF_COLORS } from "@/app/my/code/logic";
import { Card } from "./QuizTab";

export type Homework = { id: string; title: string; description: string; difficulty?: string | null };

/** Homework set by the teacher for a lesson (GET /api/homework?lessonId=). */
export default function HomeworkTab({ items }: { items: Homework[] }) {
  return (
    <Card>
      <h3 className="text-lg font-extrabold">📝 Homework</h3>
      <p className="mb-3 text-sm text-slate-400">Practise these at home. Use the Code Editor to try your answers.</p>
      <div className="space-y-3">
        {items.map((h, i) => {
          const c = DIFF_COLORS[h.difficulty || ""] || "#a78bfa";
          return (
            <div key={h.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-xs font-extrabold">{i + 1}</span>
                <b className="flex-1">{h.title}</b>
                {h.difficulty && <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: c, background: `${c}20` }}>{h.difficulty}</span>}
              </div>
              <div className="whitespace-pre-wrap text-sm text-slate-300">{h.description}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
