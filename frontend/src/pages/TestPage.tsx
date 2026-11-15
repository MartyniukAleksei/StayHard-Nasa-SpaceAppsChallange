import { useParams } from "react-router";
import { TestReport } from "@/features/test-page";
import { NotFoundPage } from "./NotFoundPage";

export function TestPage() {
  const { id } = useParams();
  const testNo = Number(id);
  if (!Number.isInteger(testNo) || testNo <= 0) return <NotFoundPage />;
  return <TestReport key={testNo} testNo={testNo} />;
}
