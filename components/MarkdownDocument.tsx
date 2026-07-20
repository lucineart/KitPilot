import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => <h1 className="document-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="document-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="document-h3">{children}</h3>,
  p: ({ children }) => <p className="document-p">{children}</p>,
  ul: ({ children }) => <ul className="document-list">{children}</ul>,
  ol: ({ children }) => <ol className="document-list document-list-ordered">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote className="document-quote">{children}</blockquote>,
  hr: () => <hr className="document-rule" />,
  a: ({ children, href }) => (
    <a className="document-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="document-table-wrap">
      <table className="document-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  code: ({ children }) => <code className="document-code">{children}</code>,
};

export function MarkdownDocument({ content }: { content: string }) {
  return (
    <article className="document-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
