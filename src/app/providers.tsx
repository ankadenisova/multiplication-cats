"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { ruAuth } from "@/lib/auth/localization";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authClient={authClient as any}
      navigate={(href) => window.location.assign(href)}
      replace={(href) => window.location.replace(href)}
      redirectTo="/"
      credentials={{ forgotPassword: true, rememberMe: true }}
      localization={ruAuth}
      defaultTheme="light"
      Link={({ href, ...props }) => <Link href={href!} {...props} />}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
