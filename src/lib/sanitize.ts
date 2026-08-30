/**
 * Server-side HTML sanitizer used to neutralize user/LLM-authored HTML
 * (campaign step bodies, signatures, templates) before it is persisted and
 * before it can be rendered via dangerouslySetInnerHTML.
 *
 * Backed by `sanitize-html` (a real HTML parser) rather than hand-written
 * regex passes, so attribute/scheme/tag handling is context-aware and not
 * subject to the classic regex-sanitizer bypass class (embedded control chars
 * in URL schemes, mutation-XSS across sequential passes, etc.).
 */

import sanitizeHtmlLib from "sanitize-html";

// Allow-listed elements that should survive (formatting semantics only).
// Anything not listed here is parsed and dropped by the library.
const ALLOWED_TAGS = [
  "a", "b", "strong", "i", "em", "u", "s", "strike", "br", "p", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead",
  "tbody", "tr", "th", "td", "blockquote", "pre", "code", "img", "hr",
  "font", "big", "small", "sub", "sup", "cite", "q", "abbr", "figure",
  "figcaption", "section", "article", "main", "header", "footer", "center",
  "dl", "dt", "dd", "col", "colgroup", "caption",
];

// Attributes that are always safe to keep (no URL/execution semantics).
const GLOBAL_ATTRS = [
  "id", "class", "style", "colspan", "rowspan", "align", "valign",
  "width", "height", "title", "lang", "dir", "border", "cellpadding",
  "cellspacing", "bgcolor",
];

const ALLOWED_ATTR: Record<string, string[]> = {
  "*": GLOBAL_ATTRS,
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "width", "height"],
};

// Remove executable/embedding/meta subtrees wholesale (including their content)
// before parsing. This mirrors the previous behavior of fully discarding these
// rather than leaking their inner text. Deletion-first is safe here; the parser
// then handles every remaining construct contextually.
const DANGEROUS_SUBTREE =
  /<(script|style|iframe|object|embed|form|input|button|select|textarea|template|svg|math|video|audio|applet|frame|frameset|noscript|noembed|meta|link|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const NAKED_DANGEROUS_OPEN =
  /<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|select|textarea|template|svg|math|video|audio|applet|frame|frameset|noscript|noembed|meta|link|base)\b[^>]*>/gi;

export function sanitizeHtml(input: string): string {
  if (!input) return input;

  let s = input;
  s = s.replace(DANGEROUS_SUBTREE, "");
  s = s.replace(NAKED_DANGEROUS_OPEN, "");

  return sanitizeHtmlLib(s, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ["http", "https", "mailto", "ftp"],
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: true,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === "_blank") {
          attribs.rel = (attribs.rel ? attribs.rel + " " : "") + "noopener noreferrer";
        }
        return { tagName, attribs };
      },
    },
  });
}
