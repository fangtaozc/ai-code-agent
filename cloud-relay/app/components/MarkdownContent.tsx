'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownContent.module.css';

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <div className={styles.md}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => (
            <pre className={styles.pre}>{children}</pre>
          ),
          code: ({ className, children, ...props }) => {
            // Block code: has className (language-xxx) or is wrapped in <pre>
            // Detect by checking if content has newlines (reliable heuristic for unnnamed blocks)
            const isBlock = !!className || String(children).includes('\n');
            return isBlock ? (
              <code className={`${styles.codeBlock} ${className ?? ''}`} {...props}>
                {children}
              </code>
            ) : (
              <code className={styles.codeInline} {...props}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
