export type AuthRole = "admin" | "operator" | "viewer";

export interface AuthenticatedUser {
  role: AuthRole;
  keyId: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
