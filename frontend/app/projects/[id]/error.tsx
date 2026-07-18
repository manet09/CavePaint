 
"use client";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-lg font-semibold mb-2 text-panel-icon">Failed to load project</h2>
      <p className="text-sm text-panel-text max-w-md mb-4">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
