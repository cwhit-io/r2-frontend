export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ADMIN_PASSWORD: string;
  ADMIN_EMAIL_DOMAIN?: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  r2_key: string;
  uploader: string;
  created_at: string;
  downloads: number;
}
