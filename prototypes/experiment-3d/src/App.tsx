import { ExperimentReplay } from "@/features/experiment-3d";

// Прототип: одна сторінка з одним тестом. ?test=NNN у адресі перемикає тест.
export function App() {
  const testNo = Number(new URLSearchParams(location.search).get("test") ?? 100);
  return <ExperimentReplay testNo={testNo} />;
}
