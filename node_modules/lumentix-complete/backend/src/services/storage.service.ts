import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export type StoredFile = {
  fileUrl: string;
  absolutePath: string;
};

export interface StorageProvider {
  saveFile(input: { buffer: Buffer; filename: string; contentType: string }): Promise<StoredFile>;
  resolvePath(fileUrl: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = path.resolve(process.cwd(), uploadDir);
  }

  async saveFile(input: { buffer: Buffer; filename: string; contentType: string }) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const absolutePath = path.join(this.uploadDir, safeFilename);
    await fs.writeFile(absolutePath, input.buffer);

    return {
      fileUrl: `/uploads/${safeFilename}`,
      absolutePath
    };
  }

  resolvePath(fileUrl: string) {
    if (!fileUrl.startsWith("/uploads/")) {
      throw new AppError("Only local files can be resolved by the local storage provider.", 400);
    }

    const resolved = path.resolve(this.uploadDir, path.basename(fileUrl));

    if (!resolved.startsWith(this.uploadDir)) {
      throw new AppError("Invalid file path.", 400);
    }

    return resolved;
  }

  getPublicDirectory() {
    return this.uploadDir;
  }
}

class S3StorageProvider implements StorageProvider {
  async saveFile(): Promise<StoredFile> {
    throw new AppError("S3 storage is configured but not implemented. Add the AWS SDK driver here.", 501);
  }

  resolvePath(): string {
    throw new AppError("S3 files should be downloaded by signed URL, not local path.", 501);
  }
}

const localProvider = new LocalStorageProvider(env.localStorageDir);

export const storageProvider: StorageProvider =
  env.storageDriver === "s3" ? new S3StorageProvider() : localProvider;

export const localUploadsDirectory = localProvider.getPublicDirectory();

