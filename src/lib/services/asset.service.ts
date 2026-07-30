import "server-only";
import { assetsRepo } from "@/lib/repositories";
import { getSpreadsheetId } from "@/lib/google/workspace";
import { computeAssetGain, computeAssetReturnPct } from "@/lib/finance";
import { generateId } from "@/lib/id";
import type { Asset } from "@/types/domain";
import type { CreateAssetInput } from "@/lib/schemas";

/** Attach derived gain / return figures to an asset. */
function withDerived(asset: Asset): Asset {
  return {
    ...asset,
    gain: computeAssetGain(asset),
    returnPct: computeAssetReturnPct(asset),
  };
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
  const asset: Asset = {
    id: generateId(),
    name: input.name,
    category: input.category,
    purchaseDate: input.purchaseDate,
    purchaseValue: input.purchaseValue,
    currentValue: input.currentValue,
    accountId: input.accountId || undefined,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  return withDerived(await assetsRepo.create(spreadsheetId, asset));
}

export async function updateAsset(
  id: string,
  input: Partial<CreateAssetInput>,
): Promise<Asset> {
  const spreadsheetId = await getSpreadsheetId();
  return withDerived(await assetsRepo.update(spreadsheetId, id, input));
}

export async function deleteAsset(id: string): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  await assetsRepo.remove(spreadsheetId, id);
}
