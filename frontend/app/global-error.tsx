 
"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-zinc-500 max-w-md mb-4">{error.message || "An unexpected error occurred."}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
