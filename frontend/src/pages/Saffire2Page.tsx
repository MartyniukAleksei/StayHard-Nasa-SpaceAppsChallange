import { useParams } from "react-router";
import { SaffireCompare, SaffireLibrary, SaffireOverview, SampleExplorer, SampleReport } from "@/features/saffire2";
import { Sample3D, Saffire3D } from "@/features/saffire2-3d";

// Saffire-II pages, same layout set as FLEX: overview 1A, explorer 2B, report 3A, compare 4A, library 5B.
export function Saffire2Page() {
  return <SaffireOverview replay={<Saffire3D bare />} />;
}

export function Saffire2SamplesPage() {
  return <SampleExplorer />;
}

export function Saffire2SamplePage() {
  const { id = "" } = useParams();
  return <SampleReport id={id} watch={(sid, onT) => <Sample3D key={sid} id={sid} onT={onT} />} />;
}

export function Saffire2ComparePage() {
  return <SaffireCompare />;
}

export function Saffire2LibraryPage() {
  return <SaffireLibrary />;
}
