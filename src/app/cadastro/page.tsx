import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/app/cadastro/register-form";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return <RegisterForm />;
}
