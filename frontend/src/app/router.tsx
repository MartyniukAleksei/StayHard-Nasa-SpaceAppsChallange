import { createBrowserRouter } from "react-router";
import { ComparePage } from "@/pages/ComparePage";
import { LandingPage } from "@/pages/LandingPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
