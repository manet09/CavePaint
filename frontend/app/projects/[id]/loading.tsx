 
export default function ProjectLoading() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-pulse">
      <div className="h-14 min-h-[56px] border-b border-zinc-200/60 dark:border-zinc-800/40 bg-card/80 px-6 flex items-center shrink-0">
        <div className="h-3 w-32 bg-zinc-200/70 dark:bg-zinc-800/70 rounded" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-1/3 bg-zinc-200/70 dark:bg-zinc-800/70 rounded" />
        <div className="h-4 w-2/3 bg-zinc-200/50 dark:bg-zinc-800/50 rounded" />
        <div className="h-4 w-1/2 bg-zinc-200/50 dark:bg-zinc-800/50 rounded" />
        <div className="h-32 w-full bg-zinc-200/30 dark:bg-zinc-800/30 rounded-2xl mt-6" />
      </div>
    </div>
  );
}
