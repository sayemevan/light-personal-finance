import "server-only";
import { getDriveClient } from "@/lib/google/client";

/**
 * Low-level Google Drive helpers for folder/file discovery and receipt uploads.
 * Higher-level orchestration (the idempotent bootstrap) lives in the service
 * layer and is not implemented yet.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

/**
 * Ids of the non-trashed files with this name and type, oldest first, so any
 * duplicates always resolve to the same original. Drive search is eventually
 * consistent: a file created moments ago (possibly by another server
 * instance) may be missing from the result.
 */
async function listByName(
  name: string,
  mimeType: string,
  parentId?: string,
  pageSize = 10,
): Promise<string[]> {
  const drive = await getDriveClient();
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${mimeType}'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : undefined,
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await drive.files.list({
    q: query,
    fields: "files(id)",
    spaces: "drive",
    orderBy: "createdTime",
    pageSize,
  });
  return (res.data.files ?? [])
    .map((file) => file.id)
    .filter((id): id is string => Boolean(id));
}

/** Find a folder by name within an optional parent. Returns its id or null. */
export async function findFolder(
  name: string,
  parentId?: string,
): Promise<string | null> {
  return (await listByName(name, FOLDER_MIME, parentId, 1))[0] ?? null;
}

/** Every folder with this name within an optional parent, oldest first. */
export async function listFolders(
  name: string,
  parentId?: string,
): Promise<string[]> {
  return listByName(name, FOLDER_MIME, parentId);
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
  return (await listByName(name, SPREADSHEET_MIME, parentId, 1))[0] ?? null;
}

/** Every spreadsheet with this name within a parent folder, oldest first. */
export async function listSpreadsheets(
  name: string,
  parentId: string,
): Promise<string[]> {
  return listByName(name, SPREADSHEET_MIME, parentId);
}

/**
 * Whether a file still exists and is not in the trash. Unlike search, a
 * lookup by id is strongly consistent.
 */
export async function isLiveFile(fileId: string): Promise<boolean> {
  const drive = await getDriveClient();
  try {
    const res = await drive.files.get({ fileId, fields: "id, trashed" });
    return res.data.trashed !== true;
  } catch (error) {
    const status = (error as { code?: number; status?: number }).code ??
      (error as { status?: number }).status;
    if (status === 404) return false;
    throw error;
  }
}

/** Move a file to the Drive trash (recoverable by the user for 30 days). */
export async function trashFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    fields: "id",
  });
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
