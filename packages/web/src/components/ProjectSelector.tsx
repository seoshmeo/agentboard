import { FolderOpen } from 'lucide-react';

interface ProjectSelectorProps {
  projectName: string;
}

export function ProjectSelector({ projectName }: ProjectSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-300">
      <FolderOpen className="w-4 h-4 text-gray-500" />
      <span className="font-medium">{projectName}</span>
    </div>
  );
}
