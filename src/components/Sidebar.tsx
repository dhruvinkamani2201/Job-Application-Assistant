"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Analyze a job" },
  { href: "/resumes", label: "Resumes" },
  { href: "/tracker", label: "Tracker" }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-line p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-lg leading-tight">Job Application<br />Assistant</h1>
        <p className="text-xs text-slate mt-1">Paste a URL. Get a match. Track it.</p>
      </div>
      <nav className="flex md:flex-col gap-1 flex-wrap">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-sm text-sm ${
                active ? "bg-moss text-white" : "text-ink hover:bg-line/50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
