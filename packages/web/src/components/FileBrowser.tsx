import { useState } from 'react';
import { X, File, Folder, FolderOpen, ChevronRight, ChevronDown, Code } from 'lucide-react';
import { useFileTree, useFileContent } from '../api/client.js';
import { useEscapeKey } from '../hooks/useEscapeKey.js';
import type { FileEntry } from '@agentboard/shared';

interface FileBrowserProps {
  projectId: string;
  onClose: () => void;
}

const LANG_COLORS: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-blue-400',
  js: 'text-yellow-400', jsx: 'text-yellow-400',
  json: 'text-green-400', yaml: 'text-green-400', yml: 'text-green-400',
  css: 'text-pink-400', scss: 'text-pink-400',
  md: 'text-gray-400', mdx: 'text-gray-400',
  py: 'text-yellow-300', rs: 'text-orange-400', go: 'text-cyan-400',
  html: 'text-orange-300', sql: 'text-violet-400',
};

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop() || '';
  const color = LANG_COLORS[ext] || 'text-gray-500';
  return <File className={`w-3.5 h-3.5 shrink-0 ${color}`} />;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function TreeNode({
  entry,
  depth,
  selectedPath,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedPath === entry.path;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-1.5 py-1 px-2 text-left hover:bg-gray-800/50 transition-colors rounded text-xs ${
            isSelected ? 'bg-gray-800' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <span className="text-gray-300 truncate">{entry.name}</span>
        </button>
        {expanded && entry.children?.map(child => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(entry.path)}
      className={`w-full flex items-center gap-1.5 py-1 px-2 text-left hover:bg-gray-800/50 transition-colors rounded text-xs ${
        isSelected ? 'bg-violet-900/30 text-violet-300' : ''
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      <FileIcon name={entry.name} />
      <span className={`truncate ${isSelected ? 'text-violet-300' : 'text-gray-400'}`}>{entry.name}</span>
      {entry.size !== undefined && (
        <span className="text-[10px] text-gray-600 ml-auto shrink-0">{formatSize(entry.size)}</span>
      )}
    </button>
  );
}

function CodeViewer({ projectId, filePath }: { projectId: string; filePath: string }) {
  const { data, isLoading, isError, error } = useFileContent(projectId, filePath);

  if (isLoading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;
  if (isError) return <div className="p-4 text-sm text-red-400">{(error as Error).message}</div>;
  if (!data) return null;

  const lines = data.content.split('\n');

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/50 sticky top-0">
        <Code className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs text-gray-400 truncate">{data.path}</span>
        <span className="text-[10px] text-gray-600 ml-auto">{data.language} · {formatSize(data.size)}</span>
      </div>
      <pre className="text-xs leading-5 p-0 m-0">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-gray-800/30">
                <td className="text-right text-gray-600 select-none px-3 py-0 w-12 align-top border-r border-gray-800/50 sticky left-0 bg-gray-950">
                  {i + 1}
                </td>
                <td className="px-4 py-0 whitespace-pre text-gray-300 font-mono overflow-x-auto">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </pre>
    </div>
  );
}

export function FileBrowser({ projectId, onClose }: FileBrowserProps) {
  useEscapeKey(onClose);
  const { data, isLoading, isError, error } = useFileTree(projectId);
  const [selectedFile, setSelectedFile] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-950 rounded-xl border border-gray-800 w-full max-w-6xl h-[80vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Files</h2>
            {data?.root && (
              <span className="text-xs text-gray-600 font-mono truncate max-w-[400px]">{data.root}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tree */}
          <div className="w-72 border-r border-gray-800 overflow-y-auto p-2 shrink-0">
            {isLoading && <p className="text-xs text-gray-500 p-2">Loading file tree...</p>}
            {isError && <p className="text-xs text-red-400 p-2">{(error as Error).message}</p>}
            {data?.tree.map(entry => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                selectedPath={selectedFile}
                onSelect={setSelectedFile}
              />
            ))}
            {data?.tree.length === 0 && (
              <p className="text-xs text-gray-600 p-2">Empty directory</p>
            )}
          </div>

          {/* Viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedFile ? (
              <CodeViewer projectId={projectId} filePath={selectedFile} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-600">Select a file to view its contents</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
