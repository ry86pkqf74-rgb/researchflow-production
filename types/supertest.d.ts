/**
 * Ambient type declarations for supertest
 * Provides minimal type definitions for HTTP assertion testing
 */
declare module 'supertest' {
  import { Express } from 'express';
  import { Server } from 'http';

  interface Response {
    status: number;
    statusCode: number;
    body: any;
    headers: Record<string, string>;
    text: string;
    type: string;
    charset: string;
    get(header: string): string;
    header: Record<string, string>;
  }

  interface Test extends Promise<Response> {
    set(field: string, val: string): Test;
    set(fields: Record<string, string>): Test;
    send(data: any): Test;
    query(params: Record<string, any>): Test;
    expect(status: number): Test;
    expect(status: number, body: any): Test;
    expect(field: string, val: string | RegExp): Test;
    expect(checker: (res: Response) => void): Test;
    attach(field: string, file: string | Buffer, options?: any): Test;
    field(name: string, val: string): Test;
    type(type: string): Test;
    accept(type: string): Test;
    auth(user: string, pass: string): Test;
    redirects(n: number): Test;
    timeout(ms: number): Test;
    then<TResult1 = Response, TResult2 = never>(
      onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ): Promise<Response | TResult>;
    end(callback: (err: any, res: Response) => void): void;
  }

  interface SuperTest<T> {
    get(url: string): Test;
    post(url: string): Test;
    put(url: string): Test;
    patch(url: string): Test;
    delete(url: string): Test;
    del(url: string): Test;
    head(url: string): Test;
    options(url: string): Test;
  }

  function supertest(app: Express | Server | string): SuperTest<Test>;

  export = supertest;
}
