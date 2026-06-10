import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

import { Kbd } from "@meetspace/ui/components/ui/kbd";
import { useCmdKeyPressed } from "@meetspace/ui/hooks/use-cmd-key-pressed";
import { cn } from "@meetspace/utils";

import { useSearchKeyboard } from "./use-search-keyboard";

import { useSearch } from "~/search/contexts/ui";

export function SidebarSearchInput() {
  const { query, setQuery, inputRef, setFocusImpl, isSearching, isIndexing } =
    useSearch();
  const isCmdPressed = useCmdKeyPressed();
  const { onKeyDown } = useSearchKeyboard();

  useEffect(() => {
    setFocusImpl(() => {
      inputRef.current?.focus();
    });
  }, [setFocusImpl, inputRef]);

  const showLoading = isSearching || isIndexing;
  const showShortcut = isCmdPressed && !query;

  return (
    <div className="relative flex h-8 shrink-0 items-center px-2">
      {showLoading ? (
        <Loader2Icon
          className={cn([
            "text-muted-foreground absolute left-5 h-4 w-4 animate-spin",
          ])}
        />
      ) : (
        <SearchIcon
          className={cn(["text-muted-foreground absolute left-5 h-4 w-4"])}
        />
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search anything..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn([
          "placeholder:text-muted-foreground text-sm placeholder:text-sm",
          "h-full w-full pl-8",
          query ? "pr-8" : showShortcut ? "pr-14" : "pr-4",
          "border-border bg-secondary/50 rounded-lg border",
          "dark:border-border dark:bg-card/50",
          "dark:focus:bg-secondary focus:bg-secondary focus:outline-hidden",
        ])}
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className={cn([
            "absolute right-5",
            "h-4 w-4",
            "text-muted-foreground hover:text-muted-foreground",
            "transition-colors",
          ])}
          aria-label="Clear search"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
      {showShortcut && (
        <div className="absolute top-1 right-4">
          <Kbd>⌘ K</Kbd>
        </div>
      )}
    </div>
  );
}
