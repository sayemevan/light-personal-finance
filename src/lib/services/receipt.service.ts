import "server-only";
import { Readable } from "node:stream";
import { getDriveClient } from "@/lib/google/client";
import { getFileMeta, deleteFile } from "@/lib/google/drive";
import type { DriveFileMeta } from "@/lib/google/drive";
import { getWorkspaceForCurrentUser } from "@/lib/google/workspace";
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

export async function getReceiptMeta(fileId: string): Promise<DriveFileMeta> {
  return getFileMeta(fileId);
}

export async function removeReceipt(fileId: string): Promise<void> {
  await deleteFile(fileId);
}
