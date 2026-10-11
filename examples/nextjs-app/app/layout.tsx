import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "Seha Care embedded consultation",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
