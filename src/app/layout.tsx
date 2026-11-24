import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบจองห้องประชุม · กองทรัพยากรบุคคล",
  description: "ระบบจองห้องประชุมกาลพฤกษ์ 10 และห้อง SMART Meeting",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
