/**
 * Minimal dependency-free HTML sanitizer used to neutralize user/LLM-authored
 * HTML (campaign step bodies, signatures, templates) before it is persisted
 * and before it can be rendered via dangerouslySetInnerHTML.
 *
 * It strips executable/embedding constructs (scripts, event handlers, dangerous
 * URL schemes, iframes/objects/embeds/metadata) while preserving benign
 * formatting tags the email editor produces.
 */

const DANGEROUS_TAGS = new Set([
  "script", "iframe", "object", "embed", "link", "meta", "base", "form",
  "input", "button", "select", "textarea", "style", "template", "svg",
  "math", "video", "audio", "source", "track", "applet", "frame", "frameset",
]);

// Allow-listed elements that should survive (formatting semantics only).
const ALLOWED_TAGS = new Set([
  "a", "b", "strong", "i", "em", "u", "s", "strike", "br", "p", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead",
  "tbody", "tr", "th", "td", "blockquote", "pre", "code", "img", "hr",
  "font", "big", "small", "sub", "sup", "cite", "q", "abbr", "figure",
  "figcaption", "section", "article", "main", "header", "footer", "center",
  "dl", "dt", "dd", "col", "colgroup", "caption",
]);

// Attributes that are always safe to keep (no URL/execution semantics).
const SAFE_ATTRS = /^(id|class|style|colspan|rowspan|align|valign|width|height|title|lang|dir|border|cellpadding|cellspacing|bgcolor)$/;

// Target/rel are controlled to neutralise `target="_blank"` phishing-friendly
// links (opener is not an executable leak by itself but is a hygiene win).
function allowedAttr(tag: string, name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (SAFE_ATTRS.test(n)) return true;
  if (tag === "a") {
    if (n === "href") return isSafeUrl(value);
    if (n === "name") return true;
    if (n === "target") return value === "_blank" || value === "_self";
    if (n === "rel") return true;
  }
  if (tag === "img") {
    if (n === "src") return isSafeUrl(value);
    if (n === "alt") return true;
  }
  return false;
}

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  // data: is allowed only for images; handled via tag check above (img src).
  if (v.startsWith("data:image/")) return true;
  if (/^(https?:)?\/\//.test(v)) return true;
  if (v.startsWith("/")) return true;
  if (v.startsWith("#")) return true;
  if (/^[a-z0-9+.-]+@/.test(v) && !/^[a-z]+:/.test(v)) return true; // mailto-ish handled below
  if (v.startsWith("mailto:")) return true;
  return false;
}

export function sanitizeHtml(input: string): string {
  if (!input) return input;

  // Strip anything in <script> style blocks wholesale (including content).
  let s = input.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Remove structural dangerous tags and their content where content would be
  // inert anyway; for foreign-object-like tags we drop both tag and body.
  s = s.replace(/<(iframe|object|embed|noembed|noscript|template|style|meta|link|base|form|input|button|select|textarea|svg|math|video|audio|applet|frame|frameset)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  // <meta>/<link>/<base> have no closing pair in HTML; strip self-closing / bare forms.
  s = s.replace(/<(meta|link|base|br)(\s[^>]*)?\/?>/gi, "<$1>");

  // Neutralise remaining dangerous tags (no body) by removing their tags.
  s = s.replace(/<\s*\/?\s*(script|iframe|object|embed|style|frame|frameset|applet|noscript|noembed|template|svg|math|video|audio)\b[^>]*>/gi, "");

  // Remove all on* event handler attributes on any element.
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Remove danger URL schemes in href/src.
  s = s.replace(/(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (match, attr, raw) => {
    const inner = raw.replace(/^["']|["']$/g, "");
    if (/^\s*(javascript|vbscript|data:text\/html|file):/i.test(inner)) {
      return `${attr}="#"`;
    }
    return match;
  });

  // Normalise <br/> and void tags that lack the self-close before reparse pass.
  s = s.replace(/<br\s*\/?>/gi, "<br>");

  // Final pass: remove any disallowed tags (allow-list) but keep their inner
  // text. This handles any tag the heuristic passes above.
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\/?>/g, (whole, tagName, attrsRaw) => {
    const t = tagName.toLowerCase();
    const isClosing = whole.startsWith("</");
    if (!ALLOWED_TAGS.has(t)) {
      // Drop the tag entirely, preserve text content.
      return "";
    }
    if (isClosing) return `</${t}>`;
    // Rebuild the open tag with only allowed attributes.
    const attrRegex = /([a-zA-Z][a-zA-Z0-9:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    const kept: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrsRaw)) !== null) {
      const name = m[1];
      const value = m[2].replace(/^["']|["']$/g, "");
      if (allowedAttr(t, name, value)) {
        kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
      }
    }
    return kept.length ? `<${t} ${kept.join(" ")}>` : `<${t}>`;
  });

  return s;
}
