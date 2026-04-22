import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function TextBlock({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-blue-700 dark:text-blue-400">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 mt-4 text-slate-900 dark:text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-md font-bold mb-1 mt-3 text-slate-800 dark:text-slate-100">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1 mt-2 text-slate-800 dark:text-slate-100">{children}</h3>
          ),
          code: ({ children }) => (
            <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[0.8rem] font-mono text-blue-600 dark:text-blue-400">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-200 dark:border-blue-900 pl-4 italic my-2 text-slate-600 dark:text-slate-400">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
