// pages/lessonPlans/MarkdownView.jsx — hiển thị giáo án Markdown (không dùng dangerouslySetInnerHTML)
import { Fragment, useMemo } from "react";
import { parseInline, parseMarkdown } from "../../utils/markdownBlocks";

function Inline({ text }) {
  return parseInline(text).map((p, i) => {
    if (p.br) return <br key={i} />;
    if (p.bold) return <strong key={i}>{p.text}</strong>;
    if (p.italic) return <em key={i}>{p.text}</em>;
    return <Fragment key={i}>{p.text}</Fragment>;
  });
}

export default function MarkdownView({ source }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className="lp-doc">
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const Tag = `h${Math.min(b.level, 4)}`;
          return (
            <Tag key={i}>
              <Inline text={b.text} />
            </Tag>
          );
        }
        if (b.type === "para")
          return (
            <p key={i}>
              <Inline text={b.text} />
            </p>
          );
        if (b.type === "hr") return <hr key={i} />;
        if (b.type === "list")
          return (
            <ul key={i} className="lp-list">
              {b.items.map((item, k) => (
                <li key={k} className={item.marker ? "numbered" : ""} style={{ marginLeft: item.level * 20 }}>
                  {item.marker && <span className="lp-marker">{item.marker}</span>}
                  <span>
                    <Inline text={item.text} />
                  </span>
                </li>
              ))}
            </ul>
          );
        if (b.type === "table")
          return (
            <div key={i} className="lp-table-wrap">
              <table className="lp-table">
                <thead>
                  <tr>
                    {b.header.map((h, k) => (
                      <th key={k}>
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, k) => (
                    <tr key={k}>
                      {r.map((c, j) => (
                        <td key={j}>
                          <Inline text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return null;
      })}
    </div>
  );
}
