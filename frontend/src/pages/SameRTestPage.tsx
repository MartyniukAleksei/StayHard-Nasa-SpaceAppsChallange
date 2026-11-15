import { useParams } from "react-router";
import { SameRTest } from "@/features/same-r";
import { NotFoundPage } from "./NotFoundPage";

export function SameRTestPage() {
  const { id } = useParams();
  const testNo = Number(id);
  if (!Number.isInteger(testNo) || testNo <= 0) return <NotFoundPage />;
  return <SameRTest key={testNo} testNo={testNo} />;
}
