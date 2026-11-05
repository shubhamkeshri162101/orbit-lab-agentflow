import { Fragment, type ReactNode } from "react";
import { Typography } from "@oaknorthbank/components";
import { VStack } from "./Stacks";

// Model output is plain text that often contains lightweight markdown
// (headings, bold, inline code, lists). There's no markdown dependency in
// this project yet, so this renders the common subset with Timber's own
// Typography components rather than dumping raw/escaped text.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((part) => part !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} style={{ fontFamily: "monospace", fontSize: "0.9em" }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraphLines.join(" ").trim() });
      paragraphLines = [];
    }
  }
  function flushBullets() {
    if (bulletItems.length > 0) {
      blocks.push({ kind: "bullets", items: bulletItems });
      bulletItems = [];
    }
  }
  function flushNumbered() {
    if (numberedItems.length > 0) {
      blocks.push({ kind: "numbered", items: numberedItems });
      numberedItems = [];
    }
  }
  function flushAll() {
    flushParagraph();
    flushBullets();
    flushNumbered();
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)$/);

    if (line === "") {
      flushAll();
    } else if (headingMatch) {
      flushAll();
      blocks.push({ kind: "heading", level: headingMatch[1].length as 1 | 2 | 3 | 4, text: headingMatch[2] });
    } else if (bulletMatch) {
      flushParagraph();
      flushNumbered();
      bulletItems.push(bulletMatch[1]);
    } else if (numberedMatch) {
      flushParagraph();
      flushBullets();
      numberedItems.push(numberedMatch[1]);
    } else {
      flushBullets();
      flushNumbered();
      paragraphLines.push(line);
    }
  }
  flushAll();
  return blocks;
}

// An agent/workflow output is a dict of declared state keys to the model's
// (often markdown-ish) text for that key — render each field with its name
// and prettified body instead of one escaped JSON blob.
export function OutputFields({ output }: { output: Record<string, string> }) {
  const entries = Object.entries(output);
  if (entries.length === 0) {
    return <Typography.Body small secondary>No output.</Typography.Body>;
  }
  return (
    <VStack gap={12}>
      {entries.map(([key, value]) => (
        <VStack gap={4} key={key}>
          {entries.length > 1 && (
            <Typography.Caption>{key}</Typography.Caption>
          )}
          <MarkdownOutput text={value} />
        </VStack>
      ))}
    </VStack>
  );
}

export function MarkdownOutput({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  if (blocks.length === 0) {
    return <Typography.Body small secondary>No output.</Typography.Body>;
  }

  return (
    <VStack gap={8}>
      {blocks.map((block, i) => {
        const key = `block-${i}`;
        if (block.kind === "heading") {
          return (
            <Typography.Heading level={block.level} key={key}>
              {renderInline(block.text, key)}
            </Typography.Heading>
          );
        }
        if (block.kind === "bullets") {
          return (
            <VStack gap={4} key={key} style={{ paddingLeft: 16 }}>
              {block.items.map((item, j) => (
                <Typography.Body small key={`${key}-${j}`}>
                  {"• "}
                  {renderInline(item, `${key}-${j}`)}
                </Typography.Body>
              ))}
            </VStack>
          );
        }
        if (block.kind === "numbered") {
          return (
            <VStack gap={4} key={key} style={{ paddingLeft: 16 }}>
              {block.items.map((item, j) => (
                <Typography.Body small key={`${key}-${j}`}>
                  {`${j + 1}. `}
                  {renderInline(item, `${key}-${j}`)}
                </Typography.Body>
              ))}
            </VStack>
          );
        }
        return (
          <Typography.Body small key={key}>
            {renderInline(block.text, key)}
          </Typography.Body>
        );
      })}
    </VStack>
  );
}
