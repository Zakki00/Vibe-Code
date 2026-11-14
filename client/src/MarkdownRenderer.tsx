import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components, Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const REMARK_PLUGINS: Options["remarkPlugins"] = [remarkGfm];
const REHYPE_PLUGINS: Options["rehypePlugins"] = [
  [rehypeHighlight, { detect: false, ignoreMissing: true }],
];

// Tailwind menghapus gaya bawaan HTML, jadi tampilan Markdown perlu diatur manual.
const markdownKomponen: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-xl font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-bold">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-3 font-semibold">{children}</h3>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-orange-400 underline"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 scroll-halus overflow-auto rounded-lg bg-neutral-950 p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-neutral-700 px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="mb-3 scroll-halus overflow-x-auto rounded-lg border border-neutral-700">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-800">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-b border-neutral-700 last:border-b-0">{children}</tr>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className="px-3 py-2 text-left font-semibold text-neutral-100"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-neutral-300">
      {children}
    </td>
  ),
};

function RenderWithThinking({ teks }: { teks: string }) {
  const parts = teks.split(/(<thinking>[\s\S]*?<\/thinking>)/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("<thinking>")) {
          const content = part
            .replace(/<thinking>/g, "")
            .replace(/<\/thinking>/g, "")
            .trim();
          return (
            <div
              key={i}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-400"
            >
              <div className="mb-1 font-semibold text-neutral-500">
                💭 Thinking
              </div>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          );
        }
        return (
          <div key={i}>
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              rehypePlugins={REHYPE_PLUGINS}
              components={markdownKomponen}
            >
              {part}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

export default memo(RenderWithThinking);
