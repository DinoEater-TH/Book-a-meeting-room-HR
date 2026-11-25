import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatThaiDate } from "@/lib/dates";
import { getUsageLogs } from "@/lib/usage-log";

export const dynamic = "force-dynamic";

function timestampLabel(iso: string): string {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${formatThaiDate(date, { short: true })} ${time} น.`;
}

export default async function LogPage() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.email)) redirect("/book");

  const logs = await getUsageLogs();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="โลโก้ระบบจองห้องประชุม" className="size-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-brand-900 sm:text-base">
                ประวัติการเข้าใช้งาน
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">เฉพาะผู้ดูแลระบบ</p>
            </div>
          </div>
          <Link
            href="/book"
            className="rounded-lg border border-brand-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
          >
            กลับไปจองห้องประชุม
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-50 px-5 py-4">
            <div>
              <h2 className="font-semibold text-brand-900">Log การเข้าใช้งานระบบ</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                บันทึกการเข้าสู่หน้าจอง การสร้าง แก้ไข และยกเลิกการจอง
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
              {logs.length} รายการล่าสุด
            </span>
          </div>

          {logs.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">ยังไม่มีประวัติการใช้งาน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-brand-50 bg-brand-50/70 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">วันเวลา</th>
                    <th className="px-3 py-2.5">อีเมล</th>
                    <th className="px-3 py-2.5">ชื่อผู้ใช้</th>
                    <th className="px-3 py-2.5">กิจกรรม</th>
                    <th className="px-5 py-2.5">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((row, index) => (
                    <tr key={`${row.timestamp}-${index}`} className={index % 2 === 1 ? "bg-brand-50/30" : ""}>
                      <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-slate-500">
                        {timestampLabel(row.timestamp)}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">{row.email}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.name || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-brand-700">
                        {row.action}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">{row.detail || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 pb-4 text-center text-xs text-slate-400">
          ระบบจองห้องประชุม · กองทรัพยากรบุคคล
        </footer>
      </main>
    </div>
  );
}
