import { createBrowserRouter } from "react-router";
import { ComparePage } from "@/pages/ComparePage";
import { LandingPage } from "@/pages/LandingPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import {
  Saffire2ComparePage,
  Saffire2LibraryPage,
  Saffire2Page,
  Saffire2SamplePage,
  Saffire2SamplesPage,
} from "@/pages/Saffire2Page";
import { SameRPage } from "@/pages/SameRPage";
import { SameRComparePage } from "@/pages/SameRComparePage";
import { SameRLibraryPage } from "@/pages/SameRLibraryPage";
import { SameRTestPage } from "@/pages/SameRTestPage";
import { SameRTestsPage } from "@/pages/SameRTestsPage";
import { StudyOverviewPage } from "@/pages/StudyOverviewPage";
import { TestPage } from "@/pages/TestPage";
import { TestsPage } from "@/pages/TestsPage";
import { Layout } from "./Layout";

// Маршрути додаються тут; сторінки — тонкі, логіка живе у features/*.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/studies/flex", element: <StudyOverviewPage /> },
      { path: "/studies/flex/tests", element: <TestsPage /> },
      { path: "/studies/flex/tests/:id", element: <TestPage /> },
      { path: "/studies/flex/compare", element: <ComparePage /> },
      { path: "/studies/flex/library", element: <LibraryPage /> },
      { path: "/studies/same-r", element: <SameRPage /> },
      { path: "/studies/same-r/tests", element: <SameRTestsPage /> },
      { path: "/studies/same-r/tests/:id", element: <SameRTestPage /> },
      { path: "/studies/same-r/compare", element: <SameRComparePage /> },
      { path: "/studies/same-r/library", element: <SameRLibraryPage /> },
      { path: "/studies/saffire2", element: <Saffire2Page /> },
      { path: "/studies/saffire2/samples", element: <Saffire2SamplesPage /> },
      { path: "/studies/saffire2/samples/:id", element: <Saffire2SamplePage /> },
      { path: "/studies/saffire2/compare", element: <Saffire2ComparePage /> },
      { path: "/studies/saffire2/library", element: <Saffire2LibraryPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
