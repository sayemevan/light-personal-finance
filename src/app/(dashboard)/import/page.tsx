"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { useImportCheck, useImportTransactions } from "@/hooks/use-import";
import type { ImportCheckResult } from "@/lib/schemas/import";
import { Button } from "@/components/ui/button";
import { FileStep, type LoadedFile } from "@/components/import/file-step";
import { MappingStep } from "@/components/import/mapping-step";
import { PreviewStep, type PreviewRow } from "@/components/import/preview-step";
import { DoneStep, type ImportSummary } from "@/components/import/done-step";
import { StepIndicator, WizardActions } from "@/components/import/wizard-parts";
import {
  dateRange,
  detectFormatFor,
  emptyMapping,
  findDuplicates,
  guessMapping,
  headerSignature,
  loadSavedMapping,
  mappingProblem,
  parseRows,
  saveMapping,
  suggestCategory,
  type ColumnMapping,
} from "@/components/import/import-model";

type Step = 1 | 2 | 3 | 4;

const FALLBACK_CATEGORY = /^(other|others|misc|miscellaneous|uncategori[sz]ed|general)/i;

function scrollTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function ImportPage() {
  const { accountOptions, categoryOptions } = useLookups();
  const currency = useCurrency();
  const checkImport = useImportCheck();
  const importTransactions = useImportTransactions();

  const [step, setStep] = React.useState<Step>(1);
  const [file, setFile] = React.useState<LoadedFile | null>(null);
  const [headerIndex, setHeaderIndex] = React.useState(0);
  const [mapping, setMapping] = React.useState<ColumnMapping>(emptyMapping);
  const [check, setCheck] = React.useState<ImportCheckResult>();
  const [included, setIncluded] = React.useState<Record<number, boolean>>({});
  const [categoryOverrides, setCategoryOverrides] = React.useState<
    Record<number, string>
  >({});
  const [tag, setTag] = React.useState("");
  const [summary, setSummary] = React.useState<ImportSummary>();

  const expenseCategories = React.useMemo(
    () => categoryOptions("expense"),
    [categoryOptions],
  );
  const incomeCategories = React.useMemo(
    () => categoryOptions("income"),
    [categoryOptions],
  );

  const dataRows = React.useMemo(
    () => file?.rows.slice(headerIndex + 1) ?? [],
    [file, headerIndex],
  );
  // Data rows may be wider than the header row; give extra columns a name.
  const headers = React.useMemo(() => {
    const header = file?.rows[headerIndex] ?? [];
    const width = Math.max(
      header.length,
      ...dataRows.slice(0, 50).map((row) => row.length),
    );
    return Array.from({ length: width }, (_, i) => header[i] ?? "");
  }, [file, headerIndex, dataRows]);

  // ---- Step 1 → 2 -------------------------------------------------------
  const goToMapping = () => {
    const signature = headerSignature(headers);
    const saved = loadSavedMapping(signature);
    const fallback = (options: { label: string; value: string }[]) =>
      options.find((option) => FALLBACK_CATEGORY.test(option.label))?.value ??
      "";
    setMapping((previous) => {
      if (saved) return { ...emptyMapping(), ...saved };
      const guessed = { ...emptyMapping(), ...guessMapping(headers) };
      return {
        ...guessed,
        dateFormat: detectFormatFor(dataRows, guessed.date),
        accountId:
          previous.accountId ||
          (accountOptions.length === 1 ? (accountOptions[0]?.value ?? "") : ""),
        expenseCategoryId:
          previous.expenseCategoryId || fallback(expenseCategories),
        incomeCategoryId: previous.incomeCategoryId || fallback(incomeCategories),
      };
    });
    setStep(2);
    scrollTop();
  };

  // A remembered mapping may point at an archived account/category.
  const problem = React.useMemo(() => {
    const valid = (id: string, options: { value: string }[]) =>
      options.some((option) => option.value === id);
    return (
      mappingProblem({
        ...mapping,
        accountId: valid(mapping.accountId, accountOptions) ? mapping.accountId : "",
        expenseCategoryId: valid(mapping.expenseCategoryId, expenseCategories)
          ? mapping.expenseCategoryId
          : "",
        incomeCategoryId: valid(mapping.incomeCategoryId, incomeCategories)
          ? mapping.incomeCategoryId
          : "",
      }) ?? (headers.length < 2 ? "Pick the header row first." : null)
    );
  }, [mapping, accountOptions, expenseCategories, incomeCategories, headers]);

  // ---- Step 2 → 3 -------------------------------------------------------
  const parsed = React.useMemo(
    () => parseRows(dataRows, mapping),
    [dataRows, mapping],
  );

  const goToPreview = async () => {
    if (problem) {
      toast.error(problem);
      return;
    }
    const range = dateRange(parsed);
    if (!range) {
      toast.error(
        "No row has a readable date. Check the date column and format.",
      );
      return;
    }
    saveMapping(headerSignature(headers), mapping);
    try {
      const result = await checkImport.mutateAsync({
        accountId: mapping.accountId,
        ...range,
      });
      setCheck(result);
      setIncluded({});
      setCategoryOverrides({});
      setStep(3);
      scrollTop();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't check for existing transactions.",
      );
    }
  };

  // ---- Step 3 -----------------------------------------------------------
  const duplicates = React.useMemo(
    () => findDuplicates(parsed, check?.existing ?? []),
    [parsed, check],
  );

  const previewRows: PreviewRow[] = React.useMemo(() => {
    const validExpense = new Set(expenseCategories.map((option) => option.value));
    return parsed.map((row) => {
      const duplicate = duplicates.get(row.index);
      return {
        ...row,
        duplicate,
        categoryId:
          categoryOverrides[row.index] ??
          suggestCategory(row, mapping, check, validExpense),
        included: row.error
          ? false
          : (included[row.index] ?? !duplicate),
      };
    });
  }, [
    parsed,
    duplicates,
    categoryOverrides,
    included,
    mapping,
    check,
    expenseCategories,
  ]);

  const toggleRow = React.useCallback(
    (index: number) =>
      setIncluded((current) => ({
        ...current,
        [index]: !(current[index] ?? !duplicates.has(index)),
      })),
    [duplicates],
  );
  const setRowsIncluded = React.useCallback(
    (indexes: number[], value: boolean) =>
      setIncluded((current) => {
        const next = { ...current };
        for (const index of indexes) next[index] = value;
        return next;
      }),
    [],
  );
  const changeCategory = React.useCallback(
    (index: number, categoryId: string) =>
      setCategoryOverrides((current) => ({ ...current, [index]: categoryId })),
    [],
  );

  const selectedRows = previewRows.filter((row) => row.included && !row.error);

  const runImport = () => {
    if (selectedRows.length === 0) {
      toast.error("Select at least one row to import.");
      return;
    }
    if (selectedRows.some((row) => !row.categoryId)) {
      toast.error("Every selected row needs a category.");
      return;
    }
    const tags = tag
      .split(",")
      .map((value) => value.trim().replace(/\s+/g, "-"))
      .filter(Boolean)
      .slice(0, 10);
    const toPayload = (row: PreviewRow) => ({
      date: row.date as string,
      amount: row.amount,
      categoryId: row.categoryId,
      merchant: row.description ? row.description.slice(0, 500) : undefined,
      notes: row.notes ? row.notes.slice(0, 500) : undefined,
      tags: tags.length ? tags : undefined,
    });

    importTransactions.mutate(
      {
        accountId: mapping.accountId,
        expenses: selectedRows
          .filter((row) => row.kind === "expense")
          .map(toPayload),
        income: selectedRows.filter((row) => row.kind === "income").map(toPayload),
      },
      {
        onSuccess: (data) => {
          setSummary({
            expenses: data.expenses,
            income: data.income,
            skippedDuplicates: previewRows.filter(
              (row) => row.duplicate && !row.included,
            ).length,
            failed: previewRows.filter((row) => row.error).length,
          });
          setStep(4);
          scrollTop();
        },
      },
    );
  };

  const restart = () => {
    setFile(null);
    setHeaderIndex(0);
    setCheck(undefined);
    setIncluded({});
    setCategoryOverrides({});
    setTag("");
    setSummary(undefined);
    setStep(1);
    scrollTop();
  };

  const back = () => {
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
    scrollTop();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 md:space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-9">
          <Link href="/settings">
            <ChevronLeft className="h-4 w-4" />
            Settings
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Import statement
          </h1>
          <p className="text-sm text-muted-foreground">
            Add transactions from a bank, bKash, Nagad or credit-card CSV.
          </p>
        </div>
        <StepIndicator step={step} />
      </div>

      {step === 1 ? (
        <>
          <FileStep
            file={file}
            headerIndex={headerIndex}
            onLoad={(loaded, detected) => {
              setFile(loaded);
              setHeaderIndex(detected);
            }}
            onHeaderChange={setHeaderIndex}
          />
          <WizardActions>
            <Button disabled={!file || dataRows.length === 0} onClick={goToMapping}>
              Next
            </Button>
          </WizardActions>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <MappingStep
            headers={headers}
            dataRows={dataRows}
            mapping={mapping}
            onChange={setMapping}
          />
          {problem ? (
            <p className="text-sm text-muted-foreground">{problem}</p>
          ) : null}
          <WizardActions>
            <Button variant="outline" onClick={back}>
              Back
            </Button>
            <Button
              disabled={Boolean(problem) || checkImport.isPending}
              onClick={() => void goToPreview()}
            >
              {checkImport.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Preview
            </Button>
          </WizardActions>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <PreviewStep
            rows={previewRows}
            currency={currency}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            tag={tag}
            onTagChange={setTag}
            onToggle={toggleRow}
            onSetIncluded={setRowsIncluded}
            onCategoryChange={changeCategory}
          />
          <WizardActions>
            <Button
              variant="outline"
              onClick={back}
              disabled={importTransactions.isPending}
            >
              Back
            </Button>
            <Button
              disabled={selectedRows.length === 0 || importTransactions.isPending}
              onClick={runImport}
            >
              {importTransactions.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Import {selectedRows.length}
            </Button>
          </WizardActions>
        </>
      ) : null}

      {step === 4 && summary ? (
        <DoneStep summary={summary} onRestart={restart} />
      ) : null}
    </div>
  );
}
