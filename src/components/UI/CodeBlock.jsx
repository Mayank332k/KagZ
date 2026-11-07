import React, { useState, useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";

const LINE_COLLAPSE_THRESHOLD = 25;

const CodeBlock = React.memo(({ language, value }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef(null);
  const { theme, resolvedTheme } = useTheme();

  const isLight = (theme === "light" || resolvedTheme === "light");
  const isDark = !isLight;

  const codeString = String(value || "").replace(/\n$/, "");
  const lineCount = codeString.split("\n").length;
  const isLongCode = lineCount > LINE_COLLAPSE_THRESHOLD;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rafId = requestAnimationFrame(() => {
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  const copyToClipboard = () => {
    if (!codeString) return;
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeStyle = isDark ? oneDark : oneLight;
  const headerTextColor = isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(26, 26, 26, 0.8)";
  const copyBtnColor = isDark ? "#ffffff" : "#1a1a1a";

  return (
    <div className={`codeBlockContainer ${isLight ? "codeBlockLight" : ""}`}>
      <div className="codeHeader">
        <div className="codeLang">
          <span style={{ opacity: 0.8, fontSize: "17px", color: headerTextColor, fontWeight: "500" }}>
            {"{/}"}
          </span>
          <span style={{ opacity: 0.8, fontSize: "14px", color: headerTextColor, fontWeight: "500" }}>
            {language || "code"}
          </span>
        </div>
        <button
          className="copyBtn"
          onClick={copyToClipboard}
          title="Copy code"
          type="button"
          aria-label="Copy code to clipboard"
          style={{ color: copyBtnColor }}
        >
          {copied ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.85 }}
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <div
        className={`codeContent ${isLongCode && !isExpanded ? "codeContentCollapsed" : ""}`}
        ref={scrollRef}
        style={{
          maxHeight: isLongCode && !isExpanded ? "320px" : isExpanded ? "none" : "420px",
        }}
      >
        <SyntaxHighlighter
          language={language || "text"}
          style={codeStyle}
          useInlineStyles={true}
          PreTag="div"
          codeTagProps={{ style: { backgroundColor: "transparent" } }}
          customStyle={{
            margin: 0,
            padding: "14px 18px",
            backgroundColor: "transparent",
            fontSize: "13.5px",
            lineHeight: "1.6",
            fontWeight: "400",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
      {isLongCode && (
        <div className="codeExpandBar">
          <button
            type="button"
            className="codeExpandBtn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <span>Collapse code ({lineCount} lines)</span>
            ) : (
              <span>Expand code ({lineCount} lines)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

export default CodeBlock;
