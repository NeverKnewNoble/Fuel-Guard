import LoginForm from "@/components/auth/loginForm";
import { safeCallbackUrl } from "@/utils/authRoutes";

export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const { callbackUrl, error } = await searchParams;

  return (
    <LoginForm
      callbackUrl={safeCallbackUrl(callbackUrl) ?? undefined}
      initialError={
        error === undefined
          ? undefined
          : error === "CredentialsSignin"
            ? "Incorrect email or password."
            : "We couldn't sign you in. Please try again."
      }
    />
  );
}
