import "server-only";
import { accountsRepo, assetsRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { computeAssetGain, computeAssetReturnPct } from "@/lib/finance";
import { todayISO } from "@/lib/recurring";
import { generateId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import type { Asset } from "@/types/domain";
import type { CreateAssetInput, SellAssetInput } from "@/lib/schemas";

/** Attach derived gain / return figures to an asset. */
function withDerived(asset: Asset): Asset {
  return {
    ...asset,
    gain: computeAssetGain(asset),
    returnPct: computeAssetReturnPct(asset),
  };
}

/** Reject an account id that doesn't exist, so balances never point at nothing. */
async function assertAccount(
  spreadsheetId: string,
  accountId: string | undefined,
  field: string,
): Promise<void> {
  if (!accountId) return;
  if (!(await accountsRepo.findById(spreadsheetId, accountId))) {
    throw AppError.validation("That account no longer exists.", {
      [field]: ["Select an existing account"],
    });
  }
}

async function findAsset(spreadsheetId: string, id: string): Promise<Asset> {
  const asset = await assetsRepo.findById(spreadsheetId, id);
  if (!asset) throw AppError.notFound("Asset not found.");
  return asset;
}

/** List assets with computed gain and return, newest purchase first. */
export async function listAssets(): Promise<Asset[]> {
  const spreadsheetId = await getSpreadsheetId();
  const assets = await assetsRepo.list(spreadsheetId);
  return assets
    .map(withDerived)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const spreadsheetId = await getSpreadsheetId();
  const accountId = input.accountId || undefined;
  await assertAccount(spreadsheetId, accountId, "accountId");
  const asset: Asset = {
    id: generateId(),
    name: input.name,
    category: input.category,
    purchaseDate: input.purchaseDate,
    purchaseValue: input.purchaseValue,
    currentValue: input.currentValue,
    valuedAt: input.valuedAt ?? todayISO(),
    accountId,
    notes: input.notes,
    createdAt: new Date().toISOString(),
    status: "owned",
  };
  return withDerived(await assetsRepo.create(spreadsheetId, asset));
}

export async function updateAsset(
  id: string,
  input: Partial<CreateAssetInput>,
): Promise<Asset> {
  const spreadsheetId = await getSpreadsheetId();
  const existing = await findAsset(spreadsheetId, id);
  const { valuedAt, ...fields } = input;
  const patch: Partial<Asset> = { ...fields };
  if (input.accountId !== undefined) {
    // An emptied "Paid from" means an external source, not account "".
    patch.accountId = input.accountId || undefined;
    await assertAccount(spreadsheetId, patch.accountId, "accountId");
  }
  if (
    input.currentValue !== undefined &&
    input.currentValue !== existing.currentValue
  ) {
    patch.valuedAt = valuedAt ?? todayISO();
  }
  return withDerived(await assetsRepo.update(spreadsheetId, id, patch));
}

/** Mark an asset as sold, crediting the proceeds to an account if given. */
export async function sellAsset(
  id: string,
  input: SellAssetInput,
): Promise<Asset> {
  const spreadsheetId = await getSpreadsheetId();
  const existing = await findAsset(spreadsheetId, id);
  if (input.saleDate < existing.purchaseDate) {
    throw AppError.validation("The sale date is before the purchase date.", {
      saleDate: ["Must be on or after the purchase date"],
    });
  }
  const saleAccountId = input.saleAccountId || undefined;
  await assertAccount(spreadsheetId, saleAccountId, "saleAccountId");
  return withDerived(
    await assetsRepo.update(spreadsheetId, id, {
      status: "sold",
      saleDate: input.saleDate,
      saleValue: input.saleValue,
      saleAccountId,
    }),
  );
}

/** Undo a sale: the asset is owned again and the proceeds leave the account. */
export async function undoAssetSale(id: string): Promise<Asset> {
  const spreadsheetId = await getSpreadsheetId();
  await findAsset(spreadsheetId, id);
  return withDerived(
    await assetsRepo.update(spreadsheetId, id, {
      status: "owned",
      saleDate: undefined,
      saleValue: undefined,
      saleAccountId: undefined,
    }),
  );
}

export async function deleteAsset(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await assetsRepo.remove(spreadsheetId, id);
}
