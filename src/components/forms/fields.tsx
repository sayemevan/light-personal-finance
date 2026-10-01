"use client";

import * as React from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Thin, typed wrappers over the shadcn Form primitives. Every module form is
 * assembled from these so field markup lives in exactly one place.
 */

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  list,
  autoFocus,
}: BaseFieldProps<T> & {
  /** id of a <datalist> offering suggestions. */
  list?: string;
  autoFocus?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              list={list}
              autoFocus={autoFocus}
              autoComplete={list ? "off" : undefined}
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  step = "0.01",
  autoFocus,
  className,
}: BaseFieldProps<T> & {
  step?: string;
  /** Focus on open so the phone's number pad comes up straight away. */
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              step={step}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className={className}
              value={field.value ?? ""}
              onChange={(event) =>
                field.onChange(
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
                )
              }
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField<T extends FieldValues>({
  control,
  name,
  label,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  options,
}: BaseFieldProps<T> & { options: { label: string; value: string }[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value ?? ""}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder ?? "Select…"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Chip-style tag input: type a word and press space, comma or Enter. Stores a
 * string[]; a leading "#" is optional and stripped.
 */
export function TagsField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Add a tag, e.g. trip",
  suggestions = [],
}: BaseFieldProps<T> & { suggestions?: string[] }) {
  const [draft, setDraft] = React.useState("");
  const listId = React.useId();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const tags: string[] = Array.isArray(field.value) ? field.value : [];
        const add = (raw: string) => {
          const tag = raw.trim().replace(/^#/, "").toLowerCase();
          if (tag && !tags.includes(tag) && tags.length < 10) {
            field.onChange([...tags, tag]);
          }
          setDraft("");
        };
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring sm:min-h-9 sm:rounded-md">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                >
                  #{tag}
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() =>
                      field.onChange(tags.filter((t) => t !== tag))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              <FormControl>
                <input
                  ref={field.ref}
                  list={listId}
                  value={draft}
                  placeholder={tags.length === 0 ? placeholder : undefined}
                  enterKeyHint="done"
                  autoCapitalize="off"
                  className="h-8 min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/[\s,]$/.test(value)) add(value.slice(0, -1));
                    else setDraft(value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      add(draft);
                    } else if (
                      event.key === "Backspace" &&
                      !draft &&
                      tags.length > 0
                    ) {
                      field.onChange(tags.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    if (draft) add(draft);
                    field.onBlur();
                  }}
                />
              </FormControl>
              <datalist id={listId}>
                {suggestions
                  .filter((tag) => !tags.includes(tag))
                  .map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
              </datalist>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
