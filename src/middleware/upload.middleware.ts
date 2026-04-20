import multer from "multer";
import { AppError } from "../utils/errors";

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, callback) {
    const allowed = file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv");
    if (!allowed) {
      callback(new AppError("Only CSV uploads are allowed.", 400));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});
