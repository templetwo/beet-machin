import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface SearchSelectOption {
  value: string;
  label: string;
  keywords?: readonly string[];
}

function matches(option: SearchSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (option.label.toLowerCase().includes(q)) return true;
  return option.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
}

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search…",
  emptyText = "No sounds found."
}: {
  label: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => options.filter((o) => matches(o, query)),
    [options, query]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  const commit = (option: SearchSelectOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  const activeOptionId =
    open && filtered[activeIndex] ? `${listId}-opt-${filtered[activeIndex].value}` : undefined;

  return (
    <div className="knob wide search-select" ref={containerRef}>
      <label>
        {label}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      {open && (
        <ul className="search-select-list" id={listId} role="listbox" aria-label={label}>
          {filtered.length === 0 && <li className="search-select-empty">{emptyText}</li>}
          {filtered.map((option, i) => (
            <li
              key={option.value}
              id={`${listId}-opt-${option.value}`}
              role="option"
              aria-selected={option.value === value}
              className={`search-select-option${i === activeIndex ? " active" : ""}${
                option.value === value ? " selected" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(option);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
