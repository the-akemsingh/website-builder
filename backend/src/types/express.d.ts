
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      name?:string;
      email?: string;
    }
  }
}
export {};