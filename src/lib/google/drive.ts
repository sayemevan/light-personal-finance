import "server-only";
import { getDriveClient } from "@/lib/google/client";

/**
 * Low-level Google Drive helpers for folder/file discovery and receipt uploads.
 * Higher-level orchestration (the idempotent bootstrap) lives in the service
 * layer and is not implemented yet.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** Find a folder by name within an optional parent. Returns its id or null. */
export async function findFolder(
  name: string,
  parentId?: string,
): Promise<string | null> {
  const drive = await getDriveClient();
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : undefined,
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Create a folder under an optional parent and return its id. */
export async function createFolder(
  name: string,
  parentId?: string,
): Promise<string> {
  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!res.data.id) {
    throw new Error(`Failed to create folder "${name}"`);
  }
  return res.data.id;
}

/** Find a spreadsheet by name within a parent folder. Returns its id or null. */
export async function findSpreadsheet(
  name: string,
  parentId: string,
): Promise<string | null> {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: [
      `name = '${name.replace(/'/g, "\\'")}'`,
      `mimeType = '${SPREADSHEET_MIME}'`,
      `'${parentId}' in parents`,
      "trashed = false",
    ].join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Metadata for a stored receipt. */
export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

/** Fetch lightweight metadata for a single Drive file. */
export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  const drive = await getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, webViewLink, thumbnailLink",
  });
  return {
    id: res.data.id ?? fileId,
    name: res.data.name ?? "",
    mimeType: res.data.mimeType ?? "application/octet-stream",
    webViewLink: res.data.webViewLink ?? undefined,
    thumbnailLink: res.data.thumbnailLink ?? undefined,
  };
}

/** Permanently delete a Drive file (used when removing a receipt). */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId });
}
