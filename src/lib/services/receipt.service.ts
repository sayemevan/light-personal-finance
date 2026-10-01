import "server-only";
import { Readable } from "node:stream";
import { getDriveClient } from "@/lib/google/client";
import { getFileMeta, deleteFile } from "@/lib/google/drive";
import type { DriveFileMeta } from "@/lib/google/drive";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
import { DRIVE_STRUCTURE } from "@/config/google";
import { AppError } from "@/lib/errors";

export interface UploadedReceipt {
  fileId: string;
}

/** Upload a receipt into the user's Drive `Receipts/` folder. */
export async function uploadReceipt(file: File): Promise<UploadedReceipt> {
  const { receiptsFolderId } = await getWorkspaceForCurrentUser();
  const drive = await getDriveClient();

  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: {
      name: file.name || `receipt-${Date.now()}`,
      parents: [receiptsFolderId],
    },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw AppError.internal("Failed to upload the receipt.");
  }
  return { fileId: created.data.id };
}

/**
 * Throw unless `fileId` is a receipt: a file directly inside a "Receipts"
 * folder in the user's "My Finance" folder.
 *
 * The app's Drive scope reaches every file it created, including the Finance
 * spreadsheet and the archives, and Drive deletes skip the trash. Without
 * this check a client-supplied id could permanently delete those. Any
 * "Receipts" folder qualifies, not just the current one: early sign-ins could
 * create duplicate folders, and older receipts may live in any of them.
 */
export async function assertReceipt(fileId: string): Promise<void> {
  const { rootFolderId } = await getWorkspaceForCurrentUser();
  const drive = await getDriveClient();
  const notReceipt = () => AppError.notFound("Receipt not found.");

  const file = await drive.files
    .get({ fileId, fields: "mimeType, parents, trashed" })
    .catch(() => {
      throw notReceipt();
    });
  if (
    file.data.trashed ||
    file.data.mimeType?.startsWith("application/vnd.google-apps.")
  ) {
    throw notReceipt();
  }

  for (const parentId of file.data.parents ?? []) {
    const parent = await drive.files
      .get({ fileId: parentId, fields: "name, mimeType, parents" })
      .catch(() => null);
    if (
      parent?.data.name === DRIVE_STRUCTURE.receiptsFolder &&
      parent.data.mimeType === "application/vnd.google-apps.folder" &&
      (parent.data.parents ?? []).includes(rootFolderId)
    ) {
      return;
    }
  }
  throw notReceipt();
}

export async function getReceiptMeta(fileId: string): Promise<DriveFileMeta> {
  await assertReceipt(fileId);
  return getFileMeta(fileId);
}

export async function removeReceipt(fileId: string): Promise<void> {
  await assertReceipt(fileId);
  await deleteFile(fileId);
}
