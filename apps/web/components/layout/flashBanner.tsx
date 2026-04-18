import type { FlashState } from "@/lib/feedback";

export function FlashBanner({ message, scope, status }: FlashState) {
  if (!message || !status) {
    return null;
  }

  const isSuccess = status === "success";

  return (
    <div
      className={[
        "rounded-[1.5rem] border px-5 py-4 shadow-sm",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      ].join(" ")}
    >
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.16em]">
          {scope ? `${scope} update` : "Action update"}
        </div>
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}
