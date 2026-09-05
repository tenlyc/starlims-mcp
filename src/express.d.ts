declare module 'express' {
  type Handler = (...arguments_: any[]) => unknown;

  interface ExpressApplication {
    use(handler: Handler): ExpressApplication;
    get(path: string, handler: Handler): ExpressApplication;
    all(path: string, handler: Handler): ExpressApplication;
    listen(port: number, host: string, callback: () => void): import('node:http').Server;
  }

  interface ExpressFactory {
    (): ExpressApplication;
    json(options?: { limit?: string | number }): Handler;
  }

  const express: ExpressFactory;
  export default express;
}
