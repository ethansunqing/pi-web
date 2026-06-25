import type { Options as ReactMarkdownOptions } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// Sanitize schema tightened for assistant output: keep code highlighting +
// katex class names, strip iframe/object/style/form which could carry XSS or
// disruptive content.
const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
  strip: [...(defaultSchema.strip || []), "iframe", "object", "style", "form"],
};

export const markdownRemarkPlugins: ReactMarkdownOptions["remarkPlugins"] = [remarkGfm, remarkMath];
export const markdownPreviewRemarkPlugins: ReactMarkdownOptions["remarkPlugins"] = [remarkGfm];

// Full render of assistant markdown: gfm + math, then katex. Sanitize is a
// defense-in-depth layer — react-markdown does not render raw HTML by default,
// but sanitize ensures any future rehype-raw does not introduce an XSS path.
export const markdownRehypePlugins: ReactMarkdownOptions["rehypePlugins"] = [
  [rehypeSanitize, markdownSanitizeSchema],
  [rehypeKatex, { throwOnError: false, strict: false }],
];

export const markdownPreviewRehypePlugins: ReactMarkdownOptions["rehypePlugins"] = [
  [rehypeSanitize, markdownSanitizeSchema],
];