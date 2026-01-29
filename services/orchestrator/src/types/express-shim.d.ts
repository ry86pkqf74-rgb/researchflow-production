/**
 * Express type re-exports for ESM compatibility
 * 
 * This shim allows named imports like:
 * import { Router, Request, Response } from 'express';
 * 
 * Which would otherwise fail because @types/express uses
 * the declare namespace pattern.
 */

import * as express from 'express';
import * as core from 'express-serve-static-core';

declare module 'express' {
  // Re-export types that are in the namespace as module-level exports
  export type Request<
    P = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>
  > = core.Request<P, ResBody, ReqBody, ReqQuery, Locals>;

  export type Response<
    ResBody = any,
    Locals extends Record<string, any> = Record<string, any>
  > = core.Response<ResBody, Locals>;

  export type NextFunction = core.NextFunction;
  export type RequestHandler<
    P = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>
  > = core.RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>;

  export type ErrorRequestHandler<
    P = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>
  > = core.ErrorRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>;

  export type Router = core.Router;
  export type Application = core.Application;
  export type Express = core.Express;
}
