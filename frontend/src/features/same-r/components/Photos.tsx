import { useState } from "react";
import { apiUrl, usePhotos } from "../api";
import { onePerBurst } from "../lib/photos";

const PAGE = 8; // each photo is one read from NASA PSI

type Props = {
  /** first shot of each burst only: the crew took several near-identical photos in a row */
  bursts?: boolean;
  /** a short strip of this many photos, without "show more" */
  limit?: number;
};

/** Real photos of the experiment on the ISS. */
export function IssPhotos({ bursts = false, limit }: Props) {
  const { data, isPending, isError } = usePhotos();
  const [n, setN] = useState(limit ?? PAGE);
  if (isPending) return <p className="muted mono small">Loading photos from NASA PSI…</p>;
  if (isError || data.images.length === 0) return null;
  const all = bursts || limit ? onePerBurst(data.images) : data.images;
  const shown = all.slice(0, n);
  return (
    <figure className="sr-photos">
      <ul className={limit ? "sr-photo-grid strip" : "sr-photo-grid"}>
        {shown.map((im) => (
          <li key={im.url}>
            <a href={apiUrl(im.url)} target="_blank" rel="noreferrer">
              <img
                src={apiUrl(`${im.url}?max_side=480`)}
                alt={`ISS crew photo ${im.name}: SAME-R hardware in the Microgravity Science Glovebox`}
                loading="lazy"
              />
            </a>
          </li>
        ))}
      </ul>
      {!limit && n < all.length && (
        <div>
          <button type="button" className="btn ghost" onClick={() => setN(n + PAGE)}>
            Show {Math.min(PAGE, all.length - n)} more of {all.length - n}
          </button>
        </div>
      )}
      <figcaption className="small muted">
        The SAME-R hardware in the Microgravity Science Glovebox, ISS Expeditions 23–24, 2010.
      </figcaption>
    </figure>
  );
}
