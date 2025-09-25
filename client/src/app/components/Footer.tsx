import Link from "next/link";

export function Footer() {
  const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

  return (
    <div className="flex justify-center items-center h-12 text-neutral-400 gap-4 text-xs">
      <p>© 2025 Daruri Alese</p>
      <Link
        href='#'
        className="hover:text-neutral-300"
      >
        v{APP_VERSION}
      </Link>

    </div>
  );
}
