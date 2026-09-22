import { JetBrains_Mono, Karla, Bai_Jamjuree } from 'next/font/google'
import "./globals.css"
import type { Metadata } from "next"

// Logo (SemiBold 600) and page titles (Medium 500) both use this
// family — apply font-semibold or font-medium on top of it as needed.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-title',
})

// Body text (Light 300)
const karla = Karla({
  subsets: ['latin'],
  weight: ['300'],
  variable: '--font-body',
})

// Thai body text (Light 300) — apply font-[var(--font-body-thai)]
// on any element containing Thai copy.
const baiJamjuree = Bai_Jamjuree({
  subsets: ['thai', 'latin'],
  weight: ['300'],
  variable: '--font-body-thai',
})

export const metadata: Metadata = {
  title: "Warehouse Shortest Path Simulator",
  description: "Warehouse pathfinding optimization demo",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${karla.variable} ${baiJamjuree.variable} font-[var(--font-body)] font-light h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
