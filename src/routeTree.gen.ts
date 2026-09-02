/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as IdeasRouteImport } from './routes/ideas'
import { Route as LoginRouteImport } from './routes/login'
import { Route as WorkspaceRouteImport } from './routes/workspace'
import { Route as ApiAuthSplatRouteImport } from './routes/api/auth/$'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const IdeasRoute = IdeasRouteImport.update({
  id: '/ideas',
  path: '/ideas',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)
const WorkspaceRoute = WorkspaceRouteImport.update({
  id: '/workspace',
  path: '/workspace',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiAuthSplatRoute = ApiAuthSplatRouteImport.update({
  id: '/api/auth/$',
  path: '/api/auth/$',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/ideas': typeof IdeasRoute
  '/login': typeof LoginRoute
  '/workspace': typeof WorkspaceRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/ideas': typeof IdeasRoute
  '/login': typeof LoginRoute
  '/workspace': typeof WorkspaceRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/ideas': typeof IdeasRoute
  '/login': typeof LoginRoute
  '/workspace': typeof WorkspaceRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/ideas' | '/login' | '/workspace' | '/api/auth/$'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/ideas' | '/login' | '/workspace' | '/api/auth/$'
  id: '__root__' | '/' | '/ideas' | '/login' | '/workspace' | '/api/auth/$'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  IdeasRoute: typeof IdeasRoute
  LoginRoute: typeof LoginRoute
  WorkspaceRoute: typeof WorkspaceRoute
  ApiAuthSplatRoute: typeof ApiAuthSplatRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/ideas': {
      id: '/ideas'
      path: '/ideas'
      fullPath: '/ideas'
      preLoaderRoute: typeof IdeasRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/workspace': {
      id: '/workspace'
      path: '/workspace'
      fullPath: '/workspace'
      preLoaderRoute: typeof WorkspaceRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/auth/$': {
      id: '/api/auth/$'
      path: '/api/auth/$'
      fullPath: '/api/auth/$'
      preLoaderRoute: typeof ApiAuthSplatRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  IdeasRoute: IdeasRoute,
  LoginRoute: LoginRoute,
  WorkspaceRoute: WorkspaceRoute,
  ApiAuthSplatRoute: ApiAuthSplatRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
