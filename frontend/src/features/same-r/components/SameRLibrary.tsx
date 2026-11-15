import { useSameROverview } from "../api";
import { Cite, FileLinks, LoadError, Loading } from "./Common";
import { IssPhotos } from "./Photos";
import "./same-r.css";

/** Library: NASA documents of the study, every crew photo of the hardware, and how to cite. */
export function SameRLibrary() {
  const { data: o, isPending, isError, error } = useSameROverview();
  if (isPending) return <Loading what="library" />;
  if (isError) return <LoadError message={error.message} />;
  return (
    <div className="sr">
      <section className="band" aria-labelledby="sr-docs">
        <div className="wrap">
          <h1 id="sr-docs" className="h-display">Library</h1>
          <p className="lede">NASA documents from the SAME-R dataset. Files open from the local snapshot.</p>
          <div className="sr-docs">
            {o.documents.map((g) => (
              <div key={g.category}>
                <h2 className="sr-sub">{g.category}</h2>
                <FileLinks files={g.files} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="band" aria-labelledby="sr-photos">
        <div className="wrap">
          <h2 id="sr-photos" className="h-section">Photos from the ISS</h2>
          <IssPhotos />
        </div>
      </section>
      <Cite o={o} />
    </div>
  );
}
