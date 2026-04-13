// Provides file storage helpers for future media upload/download use cases.
export const getFileExtension = (path: string): string => {
  const cleanPath = path.split("?")[0]?.split("#")[0] ?? path;
  const parts = cleanPath.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};
