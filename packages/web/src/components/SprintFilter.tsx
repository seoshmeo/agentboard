import { Filter } from 'lucide-react';

interface SprintFilterProps {
  sprints: string[];
  value: string;
  onChange: (sprint: string) => void;
}

export function SprintFilter({ sprints, value, onChange }: SprintFilterProps) {
  if (sprints.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Filter className="w-3.5 h-3.5 text-gray-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="">All Sprints</option>
        {sprints.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
