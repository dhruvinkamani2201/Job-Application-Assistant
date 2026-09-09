import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["500", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Job Application Assistant",
  description: "Analyze jobs, match resumes, and track applications."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <div className="min-h-screen flex flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 min-w-0 p-5 md:p-10 max-w-5xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
