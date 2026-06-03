import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/preacherslens-logo.png";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <Image src={logo} alt="Preacher's Lens" height={32} />
          </Link>
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary">
            Dashboard
          </Link>
          <Link href="/dashboard/rules" className="text-sm font-medium hover:text-primary">
            Rules
          </Link>
          <Link href="/dashboard/trends" className="text-sm font-medium hover:text-primary">
            Trends
          </Link>
          <Link href="/dashboard/compare" className="text-sm font-medium hover:text-primary">
            Compare
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <UserButton />
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
