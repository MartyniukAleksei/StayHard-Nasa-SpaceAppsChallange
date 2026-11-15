import { mediaUrl, type FileItem } from "@/features/flex-tests";
import { bytes } from "@/shared/lib/format";

type Extra = { name: string; href: string; kind: string };

/** G: files of a test (or study documents) served from the data volume. */
export function FileList({ files, extra }: { files: FileItem[]; extra?: Extra }) {
  if (files.length === 0 && !extra) return <p className="muted">No files for this test in the dataset.</p>;
  return (
    <ul className="tp-files">
      {extra && (
        <li>
          <a href={extra.href} download>
            {extra.name}
          </a>
          <span className="muted small">{extra.kind}</span>
          <span className="mono small muted">CSV</span>
        </li>
      )}
      {files.map((f) => (
        <li key={f.path}>
          <a href={mediaUrl(f.path)} target="_blank" rel="noreferrer">
            {f.title ?? f.name}
          </a>
          <span className="muted small">{f.kind}</span>
          <span className="mono small muted">{bytes(f.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}
