import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for simple rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      className={`prose dark:prose-invert prose-sm max-w-none
        prose-p:my-1 prose-li:my-0.5
        prose-headings:text-gray-200 prose-headings:mt-3 prose-headings:mb-1
        prose-code:text-violet-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg prose-pre:text-xs
        prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-gray-200
        prose-ul:pl-4 prose-ol:pl-4
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
