import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustResetPassword) redirect("/change-password");

  const items = navForRole(session.role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={session.name}
          email={session.email}
          role={session.role}
          items={items.map((i) => ({ label: i.label, href: i.href }))}
        />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
