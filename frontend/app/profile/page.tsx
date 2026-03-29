"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileRedirectPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) router.replace(`/profile/${encodeURIComponent(user.username)}`);
    else router.replace("/login");
  }, [user, isLoading, router]);

  return (
    <div className="animate-pulse rounded-2xl border border-border-default bg-bg-secondary p-8 text-center text-text-secondary">
      Opening profile…
    </div>
  );
}
