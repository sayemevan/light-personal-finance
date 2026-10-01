"use client";

import * as React from "react";

import { DATE_FORMATS, parseDate, type DateFormat } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { useLookups } from "@/hooks/use-lookups";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  detectFormatFor,
  NONE,
  type AmountMode,
  type ColumnMapping,
  type SignConvention,
} from "@/components/import/import-model";
import { Field, Segmented } from "@/components/import/wizard-parts";

export function MappingStep({
  headers,
  dataRows,
  mapping,
  onChange,
}: {
  headers: string[];
  dataRows: string[][];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  const { accountOptions, categoryOptions } = useLookups();

  const set = <K extends keyof ColumnMapping>(key: K, value: ColumnMapping[K]) =>
    onChange({ ...mapping, [key]: value });

  const columnOptions = React.useMemo(
    () =>
      headers.map((header, index) => ({
        label: header || `Column ${index + 1}`,
        value: String(index),
      })),
    [headers],
  );
  const optionalColumns = [{ label: "— None —", value: NONE }, ...columnOptions];

  const sampleDate =
    mapping.date === NONE
      ? ""
      : (dataRows.find((row) => row[Number(mapping.date)])?.[
          Number(mapping.date)
        ] ?? "");
  const parsedSample = sampleDate ? parseDate(sampleDate, mapping.dateFormat) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Columns</CardTitle>
          <CardDescription>
            Tell us which column holds what. We guessed from the headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0">
          <Field
            id="map-date"
            label="Date"
            value={mapping.date}
            onChange={(value) =>
              onChange({
                ...mapping,
                date: value,
                dateFormat: detectFormatFor(dataRows, value),
              })
            }
            options={columnOptions}
          />
          <div className="space-y-2">
            <Field
              id="map-date-format"
              label="Date format"
              value={mapping.dateFormat}
              onChange={(value) => set("dateFormat", value as DateFormat)}
              options={DATE_FORMATS.map((format) => ({
                label: format,
                value: format,
              }))}
            />
            {sampleDate ? (
              <p
                className={
                  parsedSample
                    ? "text-xs text-muted-foreground"
                    : "text-xs text-destructive"
                }
              >
                “{sampleDate}” →{" "}
                {parsedSample ? formatDate(parsedSample) : "doesn't match"}
              </p>
            ) : null}
          </div>
          <Field
            id="map-description"
            label="Description / merchant"
            value={mapping.description}
            onChange={(value) => set("description", value)}
            options={optionalColumns}
          />
          <Field
            id="map-notes"
            label="Notes (optional)"
            value={mapping.notes}
            onChange={(value) => set("notes", value)}
            options={optionalColumns}
          />

          <div className="space-y-2 sm:col-span-2">
            <Label>Amounts</Label>
            <Segmented<AmountMode>
              label="Amount columns"
              value={mapping.amountMode}
              onChange={(value) => set("amountMode", value)}
              options={[
                { label: "One amount column", value: "signed" },
                { label: "Debit & credit", value: "split" },
              ]}
            />
          </div>

          {mapping.amountMode === "signed" ? (
            <>
              <Field
                id="map-amount"
                label="Amount"
                value={mapping.amount}
                onChange={(value) => set("amount", value)}
                options={columnOptions}
              />
              <div className="space-y-2">
                <Label>Which amounts are expenses?</Label>
                <Segmented<SignConvention>
                  label="Sign convention"
                  value={mapping.sign}
                  onChange={(value) => set("sign", value)}
                  options={[
                    { label: "Negative (−)", value: "negative_expense" },
                    { label: "Positive (+)", value: "positive_expense" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  “Dr” amounts count as negative, “Cr” as positive.
                </p>
              </div>
            </>
          ) : (
            <>
              <Field
                id="map-debit"
                label="Debit / withdrawal (money out)"
                value={mapping.debit}
                onChange={(value) => set("debit", value)}
                options={optionalColumns}
              />
              <Field
                id="map-credit"
                label="Credit / deposit (money in)"
                value={mapping.credit}
                onChange={(value) => set("credit", value)}
                options={optionalColumns}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Where it goes</CardTitle>
          <CardDescription>
            The account this statement belongs to and the categories used
            when we can&apos;t suggest one.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-3 sm:p-6 sm:pt-0">
          <Field
            id="map-account"
            label="Account"
            value={mapping.accountId}
            onChange={(value) => set("accountId", value)}
            options={accountOptions}
            placeholder="Choose account"
          />
          <Field
            id="map-expense-category"
            label="Default expense category"
            value={mapping.expenseCategoryId}
            onChange={(value) => set("expenseCategoryId", value)}
            options={categoryOptions("expense")}
          />
          <Field
            id="map-income-category"
            label="Default income category"
            value={mapping.incomeCategoryId}
            onChange={(value) => set("incomeCategoryId", value)}
            options={categoryOptions("income")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
