import type { Metadata } from "next";
import "./globals.css";
import MobileWarning from "@/components/MobileWarning";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "an iPod",
  description: "play your songs here please",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <html lang="en">
        <body className="antialiased">
          {children}
          <MobileWarning />
        </body>
      </html>
    </Providers>
  );
}