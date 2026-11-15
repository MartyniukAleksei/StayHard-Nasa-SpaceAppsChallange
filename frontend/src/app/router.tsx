import { createBrowserRouter, Navigate } from "react-router";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { StudyOverviewPage } from "@/pages/StudyOverviewPage";
import { Layout } from "./Layout";

// Маршрути додаються тут; сторінки — тонкі, логіка живе у features/*.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Поки дослідження одне, головна веде одразу на Огляд FLEX.
      { path: "/", element: <Navigate to="/studies/flex" replace /> },
      { path: "/studies/flex", element: <StudyOverviewPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
