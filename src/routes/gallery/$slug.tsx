import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gallery/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/ideas" });
  },
});
