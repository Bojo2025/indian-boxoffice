import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/movies")({
  component: MoviesLayout,
});

function MoviesLayout() {
  return <Outlet />;
}
