import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultPending } from "./components/DefaultPending";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Route transitions show a neutral loading state, never the previous
    // page's content: a route must never render another page, even transiently.
    defaultPendingMs: 100,
    defaultPendingComponent: DefaultPending,
  });

  return router;
};
