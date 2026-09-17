import React from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "@/components/brand/Logo";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background px-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block" aria-label="STÆSJ">
            <Wordmark sizeClass="text-4xl" />
          </Link>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}