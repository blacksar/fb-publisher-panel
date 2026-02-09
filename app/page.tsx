import { redirect } from "next/navigation";

export default function Home() {
  // El middleware redirige "/" a /login o /dashboard según sesión.
  // Fallback por si el middleware no aplica (ej. build estático).
  redirect("/login");
}
