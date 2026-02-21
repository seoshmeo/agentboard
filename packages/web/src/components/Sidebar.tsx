import { useState, useEffect } from 'react';
import { LayoutDashboard, FolderKanban, Map, Activity, FolderOpen, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils.js';
import type { Role } from '@agentboard/shared';

export type Page = 'board' | 'projects' | 'roadmap' | 'activity' | 'files' | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  hasLocalPath: boolean;
  role?: Role;
  onLogout: () => void;
}

const SIDEBAR_KEY = 'agentboard_sidebar_open';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  condition?: boolean;
}

export function Sidebar({ activePage, onNavigate, hasLocalPath, role, onLogout }: SidebarProps) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(open));
  }, [open]);

  const navItems: NavItem[] = [
    { id: 'board', label: 'Board', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'roadmap', label: 'Roadmap', icon: Map },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'files', label: 'Files', icon: FolderOpen, condition: hasLocalPath },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-all duration-200 overflow-hidden',
        open ? 'w-56' : 'w-14'
      )}
    >
      <nav className="flex-1 py-2">
        {navItems.map(item => {
          if (item.condition === false) return null;
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={!open ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'text-violet-400 bg-violet-500/10 border-r-2 border-violet-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 py-2">
        <button
          onClick={onLogout}
          title={!open ? 'Logout' : undefined}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800/50 transition-colors"
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          {open && <span>Logout</span>}
        </button>

        <button
          onClick={() => setOpen(!open)}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors"
        >
          {open ? (
            <>
              <ChevronLeft className="w-4.5 h-4.5 shrink-0" />
              <span>Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4.5 h-4.5 shrink-0" />
          )}
        </button>
      </div>
    </aside>
  );
}
