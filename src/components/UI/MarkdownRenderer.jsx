import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import CodeBlock from './CodeBlock';
import { healStreamingMarkdown } from '../../utils/markdownHealer';
import 'katex/dist/katex.min.css';
import './MarkdownRenderer.css';

const languageAliases = {
  js: 'javascript',
  jsx: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  cplusplus: 'cpp',
  'c++': 'cpp',
  cs: 'csharp',
  yml: 'yaml',
};

const getCodeLanguage = (className = '') => {
  const match = /language-(\w+)/.exec(className || '');
  let lang = match ? match[1].toLowerCase() : '';
  return languageAliases[lang] || lang;
};

const extractText = (node) => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && node.props && node.props.children) {
    return extractText(node.props.children);
  }
  return '';
};

const isRedundantHeading = (text) => {
  const lower = String(text).trim().toLowerCase();
  const redundantPhrases = [
    'context',
    'feedback',
    'suggestion',
    'evaluation',
    'review',
  ];
  return redundantPhrases.some(
    (phrase) => lower === phrase || lower === `${phrase}:`
  );
};

const getCalloutColor = (text) => {
  const lower = String(text).toLowerCase();
  if (/\b(warning|caution|watch out|alert|hazard)\b/i.test(lower)) {
    return '#f59e0b'; // Amber
  }
  if (/\b(pro tip|best practice|strength|tip|success)\b/i.test(lower)) {
    return '#22c55e'; // Emerald
  }
  if (/\b(feedback|suggestion|evaluation|review|assessment)\b/i.test(lower)) {
    return '#a855f7'; // Purple
  }
  if (/\b(note|important|key takeaway|key takeaways|takeaway|rule of thumb|insight|summary|overview)\b/i.test(lower)) {
    return 'var(--c-brand, #2383e2)'; // Blue
  }
  return 'var(--c-brand, #2383e2)';
};

const shouldUseAccentBar = (text, isBlockquote = false) => {
  if (isBlockquote) return true;

  const accentKeywords = [
    'context',
    'feedback',
    'rule of thumb',
    'pro tip',
    'best practice',
    'watch out',
    'warning',
    'next step',
    'next steps',
    'moving forward',
    'important',
    'note',
    'tip',
    'takeaway',
    'key takeaway',
    'key takeaways',
    'hint',
    'insight',
    'summary',
    'overview',
    'evaluation',
    'assessment',
    'review',
    'observation',
    'strength',
    'improvement',
    'suggestion',
    'caution',
    'alert',
  ];

  const lower = String(text).toLowerCase();
  const pattern = new RegExp(
    `\\b(${accentKeywords
      .map((kw) => kw.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&'))
      .join('|')})\\b`,
    'i'
  );

  return pattern.test(lower);
};

const renderHeadingOrQuestion = (Tag, defaultClassName, { children, ...props }) => {
  const rawText = extractText(children);

  if (isRedundantHeading(rawText)) {
    return null;
  }

  if (shouldUseAccentBar(rawText, Tag === 'blockquote')) {
    const accentColor = getCalloutColor(rawText);
    return (
      <div className="questionCard">
        <div className="questionCardInner">
          <div className="questionAccentBar" style={{ backgroundColor: accentColor }} />
          <div className="questionContent">
            <div className="questionText">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tag className={defaultClassName} {...props}>
      {children}
    </Tag>
  );
};

// Stable components object preserving NOEMA's original sizing, spacing & typography
const MarkdownComponents = {
  h1: (props) =>
    renderHeadingOrQuestion(
      'h1',
      'text-[21px] font-bold mt-4 mb-2 tracking-tight text-gray-900 dark:text-white',
      props
    ),
  h2: (props) =>
    renderHeadingOrQuestion(
      'h2',
      'text-[18px] font-semibold mt-3.5 mb-1.5 tracking-tight text-gray-900 dark:text-white',
      props
    ),
  h3: (props) =>
    renderHeadingOrQuestion(
      'h3',
      'text-[16px] font-semibold mt-2.5 mb-1 tracking-tight text-gray-900 dark:text-white',
      props
    ),
  h4: (props) =>
    renderHeadingOrQuestion(
      'h4',
      'text-[14.5px] font-semibold mt-2 mb-1 tracking-tight text-gray-700 dark:text-gray-300',
      props
    ),
  blockquote: (props) => {
    const rawText = extractText(props.children);
    const accentColor = getCalloutColor(rawText);
    return (
      <div className="questionCard">
        <div className="questionCardInner">
          <div className="questionAccentBar" style={{ backgroundColor: accentColor }} />
          <div className="questionContent">
            <div className="questionText">{props.children}</div>
          </div>
        </div>
      </div>
    );
  },
  p: (props) => {
    const rawText = extractText(props.children).trim();
    const firstWordMatch = rawText.match(/^([A-Za-z\s-]+)([:.-]|\s{2,})/);
    if (firstWordMatch && shouldUseAccentBar(firstWordMatch[1])) {
      const accentColor = getCalloutColor(firstWordMatch[1]);
      return (
        <div className="questionCard">
          <div className="questionCardInner">
            <div className="questionAccentBar" style={{ backgroundColor: accentColor }} />
            <div className="questionContent">
              <div className="questionText">{props.children}</div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <p className="mb-2.5 leading-[1.68] last:mb-0 text-[15px] whitespace-pre-wrap" {...props}>
        {props.children}
      </p>
    );
  },
  ul: ({ children, className }) => (
    <ul className={`list-disc pl-5 mb-3 text-[15px] space-y-1.5 ${className || ''}`}>{children}</ul>
  ),
  ol: ({ children, className }) => (
    <ol className={`list-decimal pl-5 mb-3 text-[15px] space-y-1.5 ${className || ''}`}>{children}</ol>
  ),
  li: ({ children, className }) => (
    <li className={`leading-[1.65] ${className || ''}`}>{children}</li>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-3.5 border border-gray-200 dark:border-[#262626] rounded-lg bg-white dark:bg-[#141414] shadow-sm">
      <table className="w-full text-left border-collapse text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50 dark:bg-white/[0.05] border-b border-gray-200 dark:border-[#262626]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y-0">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-gray-200 dark:border-[#262626] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3.5 py-2 font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-[#262626] last:border-r-0 whitespace-nowrap tracking-tight bg-gray-50/80 dark:bg-white/[0.04]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2 text-gray-700 dark:text-[#d1cfca] border-r border-gray-200 dark:border-[#262626] last:border-r-0 align-middle tabular-nums whitespace-nowrap">
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-950 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-800 dark:text-gray-200">{children}</em>
  ),
  a: ({ href, children, ...props }) => {
    const isExternal =
      href &&
      (href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//'));
    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors cursor-pointer"
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt || ''}
      className="max-w-full h-auto rounded-lg my-2.5 border border-gray-200 dark:border-[#262626] shadow-sm"
      loading="lazy"
      {...props}
    />
  ),
  hr: (props) => (
    <hr className="my-3.5 border-0 border-t border-gray-200 dark:border-white/10" {...props} />
  ),
  details: ({ children, ...props }) => (
    <details
      className="my-2.5 border border-gray-200 dark:border-white/10 rounded-lg p-3 bg-gray-50/50 dark:bg-white/[0.02] text-[14.5px]"
      {...props}
    >
      {children}
    </details>
  ),
  summary: ({ children, ...props }) => (
    <summary
      className="font-semibold cursor-pointer select-none text-gray-900 dark:text-gray-100 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      {...props}
    >
      {children}
    </summary>
  ),
  kbd: ({ children, ...props }) => (
    <kbd
      className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded shadow-xs text-gray-800 dark:text-gray-200 font-medium"
      {...props}
    >
      {children}
    </kbd>
  ),
  code({ className, children, ...props }) {
    const isInline = !className || !className.includes('language-');
    if (isInline) {
      return (
        <code
          className="rounded-[5px] bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13.5px] text-gray-800 dark:text-gray-200"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const codeEl = React.Children.toArray(children).find(
      (child) =>
        React.isValidElement(child) &&
        (child.type === 'code' ||
          child.props?.mdastName === 'code' ||
          (typeof child.props?.className === 'string' &&
            child.props.className.includes('language-')) ||
          typeof child.props?.children === 'string')
    );
    if (codeEl) {
      const { className, children: codeChildren } = codeEl.props;
      const language = getCodeLanguage(className);
      return (
        <CodeBlock
          language={language || 'code'}
          value={String(codeChildren).replace(/\n$/, '')}
        />
      );
    }
    return <pre>{children}</pre>;
  },
};

const remarkPluginsList = [remarkGfm, remarkMath];
const rehypePluginsList = [rehypeRaw, rehypeKatex];

/**
 * Safely format plain-text keyboard shortcuts outside code blocks into <kbd> badges
 */
function formatKbdShortcuts(text) {
  if (!text || !/(Ctrl|Cmd|Alt|Shift|Option|Command|⌘|⌥|⇧|⌃)\s*\+/i.test(text)) {
    return text;
  }
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part;
      return part.replace(
        /\b(Ctrl|Cmd|Alt|Shift|Option|Command)\s*\+\s*([A-Za-z0-9]|Enter|Tab|Space|Backspace|Delete|Esc)\b/gi,
        '<kbd>$1</kbd> + <kbd>$2</kbd>'
      );
    })
    .join('');
}

const MarkdownRenderer = ({ content, isStreaming = false }) => {
  // Pre-process interactive tags & plain keyboard shortcuts
  const baseContent = content
    ? formatKbdShortcuts(
        content
          .replace(/<interactive_choice>[\s\S]*?(?:<\/interactive_choice>|$)/gi, '')
          .replace(/```(?:interactive-choice|interactive_choice)[\s\S]*?(?:```|$)/gi, '')
          .replace(/<(?:think|thought)>[\s\S]*?(?:<\/(?:think|thought)>|$)/gi, '')
          .replace(/<br\s*\/?>/gi, '  \n')
      )
    : '';

  // Heal incomplete markdown fences/math tags during active streaming
  const processedContent = isStreaming
    ? healStreamingMarkdown(baseContent)
    : baseContent;

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={remarkPluginsList}
        rehypePlugins={rehypePluginsList}
        components={MarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);
