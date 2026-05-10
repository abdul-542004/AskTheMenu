import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "QR Codes | AskTheMenu",
  description:
    "View and print QR codes for each table. Scan to open the menu chatbot.",
};

// ── Static table data (matches the 5 tables from seed) ─────────────────────
const TABLES = [
  { label: "Table 1", qrSlug: "table-1" },
  { label: "Table 2", qrSlug: "table-2" },
  { label: "Table 3", qrSlug: "table-3" },
  { label: "Table 4", qrSlug: "table-4" },
  { label: "Table 5", qrSlug: "table-5" },
];

function QRGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {TABLES.map((table) => (
        <div
          key={table.qrSlug}
          className="group relative flex flex-col items-center rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          {/* QR Image */}
          <div className="relative mb-4 aspect-square w-44 overflow-hidden rounded-xl bg-white p-2 ring-1 ring-border/30">
            <Image
              src={`/qr/${table.qrSlug}.png`}
              alt={`QR code for ${table.label}`}
              fill
              className="object-contain"
              sizes="176px"
            />
          </div>

          {/* Label */}
          <h2 className="mb-1 font-semibold text-foreground text-lg">
            🍽 {table.label}
          </h2>

          {/* Link */}
          <Link
            href={`/chat/${table.qrSlug}`}
            className="mb-2 text-muted-foreground text-xs underline-offset-2 hover:text-primary hover:underline"
          >
            /chat/{table.qrSlug}
          </Link>

          {/* Instruction */}
          <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            Scan to view menu &amp; order
          </span>
        </div>
      ))}
    </div>
  );
}

export default function QRPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 font-bold text-2xl tracking-tight md:text-3xl">
          🍽 AskTheMenu — QR Codes
        </h1>
        <p className="text-muted-foreground text-sm">
          Print or scan these QR codes to open each table&apos;s menu chatbot.
        </p>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/qr/qr-sheet.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 font-medium text-sm shadow-sm transition-colors hover:bg-muted"
        >
          🖨 Printable Sheet
        </a>
        <Link
          href="/kitchen"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 font-medium text-sm shadow-sm transition-colors hover:bg-muted"
        >
          👨‍🍳 Kitchen Dashboard
        </Link>
      </div>

      {/* QR Grid */}
      <Suspense
        fallback={
          <p className="text-center text-muted-foreground text-sm">
            Loading QR codes…
          </p>
        }
      >
        <QRGrid />
      </Suspense>

      {/* Footer hint */}
      <p className="mt-10 text-center text-muted-foreground text-xs">
        QR codes link to the deployed app. Run{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
          node scripts/generate-qr-codes.mjs --base-url https://your-url.com
        </code>{" "}
        to regenerate with a custom URL.
      </p>
    </main>
  );
}
