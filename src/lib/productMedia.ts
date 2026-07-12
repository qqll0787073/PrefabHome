import { manufacturerEditableProductStatuses } from "./products";
import { supabase } from "./supabase";
import type {
  ProductLifecycleStatus,
  ProductMediaRecord,
  ProductMediaType,
  ProductMediaUploadInput,
  ProductMediaVisibility,
  PublicProductMediaRecord,
} from "../types";

export const productImageBucket = "product-images";
export const productDocumentBucket = "product-documents";

export const imageMediaTypes: ProductMediaType[] = [
  "exterior_image",
  "interior_image",
  "floor_plan",
  "rendering",
  "factory_photo",
];

export const documentMediaTypes: ProductMediaType[] = [
  "specification_sheet",
  "catalog",
  "installation_manual",
  "certification",
  "other_document",
];

export const productMediaTypes: ProductMediaType[] = [
  ...imageMediaTypes,
  ...documentMediaTypes,
];

export const productMediaVisibilities: ProductMediaVisibility[] = ["public", "private"];

export const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
export const documentMimeTypes = ["application/pdf"];
export const documentExtensions = [".pdf"];
export const maxImageFileSizeBytes = 10 * 1024 * 1024;
export const maxDocumentFileSizeBytes = 25 * 1024 * 1024;

type UploadFileLike = Pick<File, "name" | "size" | "type">;

export function isImageMediaType(mediaType: ProductMediaType): boolean {
  return imageMediaTypes.includes(mediaType);
}

export function isDocumentMediaType(mediaType: ProductMediaType): boolean {
  return documentMediaTypes.includes(mediaType);
}

export function getProductMediaBucket(mediaType: ProductMediaType): string {
  return isImageMediaType(mediaType) ? productImageBucket : productDocumentBucket;
}

export function canEditProductMedia(status: ProductLifecycleStatus): boolean {
  return manufacturerEditableProductStatuses.includes(status);
}

export function sanitizeFilename(filename: string): string {
  const normalized = filename
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.toLowerCase() ?? "file";
  const sanitized = normalized
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");

  return sanitized || "file";
}

export function createProductMediaStoragePath(
  manufacturerId: string,
  productId: string,
  filename: string,
  id: string = crypto.randomUUID()
): string {
  return `${manufacturerId}/${productId}/${id}-${sanitizeFilename(filename)}`;
}

function fileExtension(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const index = sanitized.lastIndexOf(".");
  return index >= 0 ? sanitized.slice(index) : "";
}

export function validateProductMediaFile(
  file: UploadFileLike,
  mediaType: ProductMediaType
): string[] {
  const errors: string[] = [];
  const isImage = isImageMediaType(mediaType);
  const allowedMimes = isImage ? imageMimeTypes : documentMimeTypes;
  const allowedExtensions = isImage ? imageExtensions : documentExtensions;
  const maxSize = isImage ? maxImageFileSizeBytes : maxDocumentFileSizeBytes;
  const label = isImage ? "Image" : "Document";

  if (file.size <= 0) errors.push(`${label} file cannot be empty.`);
  if (file.size > maxSize) {
    errors.push(
      `${label} file is too large. Maximum size is ${isImage ? "10 MB" : "25 MB"}.`
    );
  }

  if (!allowedMimes.includes(file.type)) {
    errors.push(`${label} MIME type is not allowed.`);
  }

  if (!allowedExtensions.includes(fileExtension(file.name))) {
    errors.push(`${label} file extension is not allowed.`);
  }

  return errors;
}

export function toProductMediaInsertPayload(input: ProductMediaUploadInput) {
  const storageBucket = getProductMediaBucket(input.mediaType);
  const storagePath = createProductMediaStoragePath(
    input.manufacturerId,
    input.productId,
    input.file.name
  );

  return {
    product_id: input.productId,
    media_type: input.mediaType,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    original_filename: input.file.name,
    mime_type: input.file.type,
    file_size_bytes: input.file.size,
    title: input.title?.trim() || null,
    alt_text: input.altText?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    is_primary: input.isPrimary ?? false,
    visibility: input.visibility ?? (storageBucket === productImageBucket ? "public" : "private"),
  };
}

export function primaryImagePayload(): Pick<ProductMediaRecord, "is_primary"> {
  return { is_primary: true };
}

export function shouldRemoveUploadedObjectAfterMetadataFailure(
  uploadSucceeded: boolean,
  metadataCreated: boolean
): boolean {
  return uploadSucceeded && !metadataCreated;
}

export function toReadableProductMediaError(error: {
  code?: string;
  message?: string;
  statusCode?: string | number;
}): Error {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("draft or rejected") || message.includes("locked")) {
    return new Error("This product is locked. Media can be changed only while draft or rejected.");
  }

  if (message.includes("approved manufacturer")) {
    return new Error("Only approved manufacturers can manage product media.");
  }

  if (message.includes("storage path")) {
    return new Error("The storage path is not authorized for this product.");
  }

  if (message.includes("duplicate") || error.code === "23505") {
    return new Error("A media item already uses this storage path or primary slot.");
  }

  if (message.includes("mime")) {
    return new Error("This file type is not allowed.");
  }

  if (message.includes("size") || message.includes("too large")) {
    return new Error("This file is too large.");
  }

  if (message.includes("private") || message.includes("signed url")) {
    return new Error("Private document access was denied.");
  }

  if (message.includes("not found") || message.includes("missing")) {
    return new Error("The storage object is missing.");
  }

  if (
    message.includes("permission denied") ||
    message.includes("violates row-level security") ||
    error.statusCode === 401 ||
    error.statusCode === 403
  ) {
    return new Error("You are not authorized to manage this product media.");
  }

  return new Error(error.message ?? "Unable to manage product media.");
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export async function fetchOwnProductMedia(productId: string): Promise<ProductMediaRecord[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw toReadableProductMediaError(error);
  return (data ?? []) as ProductMediaRecord[];
}

export async function fetchPublicProductMedia(
  productId: string
): Promise<PublicProductMediaRecord[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("published_product_media")
    .select("id,product_id,media_type,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,title,alt_text,sort_order,is_primary,visibility,created_at")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw toReadableProductMediaError(error);
  return (data ?? []) as PublicProductMediaRecord[];
}

export async function fetchAllProductMediaForAdmin(
  productId: string
): Promise<ProductMediaRecord[]> {
  return fetchOwnProductMedia(productId);
}

export async function createProductMediaRecord(
  input: ProductMediaUploadInput
): Promise<ProductMediaRecord> {
  const client = ensureSupabase();
  const payload = toProductMediaInsertPayload(input);
  const { data, error } = await client.from("product_media").insert(payload).select("*").single();

  if (error) throw toReadableProductMediaError(error);
  return data as ProductMediaRecord;
}

async function uploadProductMedia(input: ProductMediaUploadInput): Promise<ProductMediaRecord> {
  const validationErrors = validateProductMediaFile(input.file, input.mediaType);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  const client = ensureSupabase();
  const payload = toProductMediaInsertPayload(input);
  const { error: uploadError } = await client.storage
    .from(payload.storage_bucket)
    .upload(payload.storage_path, input.file, {
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) throw toReadableProductMediaError(uploadError);

  const { data, error: recordError } = await client
    .from("product_media")
    .insert(payload)
    .select("*")
    .single();

  if (recordError) {
    if (!shouldRemoveUploadedObjectAfterMetadataFailure(true, false)) {
      throw toReadableProductMediaError(recordError);
    }
    await client.storage.from(payload.storage_bucket).remove([payload.storage_path]);
    throw toReadableProductMediaError(recordError);
  }

  return data as ProductMediaRecord;
}

export async function uploadProductImage(
  input: ProductMediaUploadInput
): Promise<ProductMediaRecord> {
  if (!isImageMediaType(input.mediaType)) {
    throw new Error("Image uploads must use an image media type.");
  }

  return uploadProductMedia(input);
}

export async function uploadProductDocument(
  input: ProductMediaUploadInput
): Promise<ProductMediaRecord> {
  if (!isDocumentMediaType(input.mediaType)) {
    throw new Error("Document uploads must use a document media type.");
  }

  return uploadProductMedia({ ...input, visibility: input.visibility ?? "private" });
}

export async function updateProductMediaMetadata(
  mediaId: string,
  values: Partial<
    Pick<ProductMediaRecord, "title" | "alt_text" | "sort_order" | "visibility" | "is_primary">
  >
): Promise<ProductMediaRecord> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("product_media")
    .update(values)
    .eq("id", mediaId)
    .select("*")
    .single();

  if (error) throw toReadableProductMediaError(error);
  return data as ProductMediaRecord;
}

export async function setPrimaryProductImage(
  productId: string,
  mediaId: string
): Promise<ProductMediaRecord> {
  const client = ensureSupabase();
  const { error: clearError } = await client
    .from("product_media")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("storage_bucket", productImageBucket);

  if (clearError) throw toReadableProductMediaError(clearError);

  const { data, error } = await client
    .from("product_media")
    .update(primaryImagePayload())
    .eq("id", mediaId)
    .select("*")
    .single();

  if (error) throw toReadableProductMediaError(error);
  return data as ProductMediaRecord;
}

export async function deleteProductMedia(media: ProductMediaRecord): Promise<void> {
  const client = ensureSupabase();
  const { error: objectError } = await client.storage
    .from(media.storage_bucket)
    .remove([media.storage_path]);

  if (objectError) throw toReadableProductMediaError(objectError);

  const { error: recordError } = await client.from("product_media").delete().eq("id", media.id);
  if (recordError) {
    throw new Error(
      "Storage object was deleted, but the media record could not be removed. Manual cleanup is required."
    );
  }
}

export async function createSignedDocumentUrl(media: ProductMediaRecord): Promise<string> {
  if (media.storage_bucket !== productDocumentBucket || media.visibility !== "private") {
    throw new Error("Signed URLs are only available for private product documents.");
  }

  const client = ensureSupabase();
  const { data, error } = await client.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, 60 * 10);

  if (error || !data?.signedUrl) {
    throw toReadableProductMediaError(error ?? { message: "Signed URL was not created." });
  }

  return data.signedUrl;
}
