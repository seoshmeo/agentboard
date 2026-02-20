import { FolderOpen, Settings } from 'lucide-react';

interface ProjectSelectorProps {
  projectName: string;
  onClick?: () => void;
}

export function ProjectSelector({ projectName, onClick }: ProjectSelectorProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors group"
    >
      <FolderOpen className="w-4 h-4 text-gray-500 group-hover:text-violet-400" />
      <span className="font-medium">{projectName}</span>
      <Settings className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400" />
    </button>
  );
}
