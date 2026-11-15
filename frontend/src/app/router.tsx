import { createBrowserRouter } from "react-router";
import { Bass2OverviewPage } from "@/pages/Bass2OverviewPage";
import { Bass2TestPage } from "@/pages/Bass2TestPage";
import { Bass2TestsPage } from "@/pages/Bass2TestsPage";
import { ComparePage } from "@/pages/ComparePage";
import { LandingPage } from "@/pages/LandingPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
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
      { path: "/studies/bass2", element: <Bass2OverviewPage /> },
      { path: "/studies/bass2/tests", element: <Bass2TestsPage /> },
      { path: "/studies/bass2/tests/:id", element: <Bass2TestPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
