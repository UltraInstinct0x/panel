import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      operatorId?: string;
    };
    operatorId?: string;
    groups?: string[];
    isAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    groups?: string[];
    isAdmin?: boolean;
    operatorId?: string;
  }
}
