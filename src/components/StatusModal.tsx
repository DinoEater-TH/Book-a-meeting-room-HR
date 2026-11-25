export default function StatusModal({ message }: { message: string }) {
  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-busy="true"
      aria-label="กำลังดำเนินการ"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-900/50 p-4 backdrop-blur-sm"
    >
      <div className="animate-pop-in w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50">
          <svg viewBox="0 0 24 24" fill="none" className="size-6 animate-spin text-brand-700" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path
              fill="currentColor"
              className="opacity-90"
              d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z"
            />
          </svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-brand-900">กำลังดำเนินการอยู่</p>
        <p className="mt-1 text-xs text-slate-500">{message}</p>
        <p className="mt-3 text-[11px] text-slate-400">กรุณารอสักครู่ อย่าปิดหน้าต่างนี้</p>
      </div>
    </div>
  );
}
