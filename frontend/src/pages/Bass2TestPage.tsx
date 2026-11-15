import { useParams } from "react-router";
import { Bass2TestPage as Report } from "@/features/bass2";
import { NotFoundPage } from "./NotFoundPage";

const TEST_ID = /^[BFMOPT]\d{1,2}[ab]?$/;

export function Bass2TestPage() {
  const { id = "" } = useParams();
  return TEST_ID.test(id) ? <Report key={id} id={id} /> : <NotFoundPage />;
}
