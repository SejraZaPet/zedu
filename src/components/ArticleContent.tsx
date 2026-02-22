import DOMPurify from "dompurify";

interface Props {
  html: string;
}

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "a",
  "ul", "ol", "li", "h2", "h3", "blockquote",
  "img", "figure", "figcaption", "div", "span",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "style",
  "class", "width", "height",
];

const ArticleContent = ({ html }: Props) => {
  // If content looks like plain text (no HTML tags), wrap in <p>
  const isPlain = !/<[a-z][\s\S]*>/i.test(html);
  const raw = isPlain
    ? html.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("")
    : html;

  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ["target"],
  });

  return (
    <div
      className={
        "prose max-w-none " +
        "[&_h2]:font-heading [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground " +
        "[&_h3]:font-heading [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-xl [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-foreground " +
        "[&_p]:font-body [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:mb-4 " +
        "[&_a]:text-primary [&_a]:underline " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground " +
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-muted-foreground " +
        "[&_img]:rounded [&_img]:mx-auto [&_img]:my-4 " +
        "[&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figcaption]:text-center [&_figcaption]:mt-1"
      }
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default ArticleContent;
