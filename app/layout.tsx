import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GuessTheWorld — весь мир в одной игре",
  description:
    "Исследуйте улицы мира, угадывайте места и соревнуйтесь с друзьями.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
