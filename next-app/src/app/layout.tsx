import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Угадай цифру — новогодний корп",
  description: "Зал угадывает загаданную цифру. Ближайший выигрывает.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
