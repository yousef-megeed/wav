// Defines the User model shape used by repositories and services.
export interface User {
  id: string;
  email: string | null;
  created_at: string;
}
