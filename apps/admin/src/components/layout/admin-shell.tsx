import { Sidebar } from './sidebar';
import { AnimatedMain } from './animated-main';

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <AnimatedMain>{children}</AnimatedMain>
    </div>
  );
}
