import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";
import { installTestHeader } from "@/lib/ideas/testSession";

export function getRouter() {
  installTestHeader(); // client: ?test=1 holds for the tab session and tags every same-origin API call (x-yard-test)
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
