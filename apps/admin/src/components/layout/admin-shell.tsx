import { Sidebar } from './sidebar';

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[#F5F5F5] h-full">{children}</main>
    </div>
  );
}
