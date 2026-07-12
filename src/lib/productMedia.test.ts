import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEditProductMedia,
  canRequestPublicSignedImageUrl,
  createProductMediaStoragePath,
  documentMediaTypes,
  getProductMediaBucket,
  imageMediaTypes,
  productDocumentBucket,
  productImageBucket,
  sanitizeFilename,
  setPrimaryProductMediaRpcArgs,
  shouldRemoveUploadedObjectAfterMetadataFailure,
  toProductMediaInsertPayload,
  toProductMediaMetadataPayload,
  toReadableProductMediaError,
  validateProductMediaFile,
} from "./productMedia";
import type { PublicProductMediaRecord } from "../types";

const imageFile = {
  name: "Front Hero.JPG",
  size: 1024,
  type: "image/jpeg",
} as File;

const documentFile = {
  name: "Spec Sheet.PDF",
  size: 4096,
  type: "application/pdf",
} as File;

describe("product media helpers", () => {
  it("sanitizes filenames for storage paths", () => {
    assert.equal(sanitizeFilename(" My Product Render (Final).JPG "), "my-product-render-final.jpg");
    assert.equal(sanitizeFilename("../Factory Plan.pdf"), "factory-plan.pdf");
    assert.equal(sanitizeFilename(""), "file");
  });

  it("generates owner-aware storage paths", () => {
    assert.equal(
      createProductMediaStoragePath(
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "Hero Image.png",
        "33333333-3333-3333-3333-333333333333"
      ),
      "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333-hero-image.png"
    );
  });

  it("maps media types to storage buckets", () => {
    for (const mediaType of imageMediaTypes) {
      assert.equal(getProductMediaBucket(mediaType), productImageBucket);
    }

    for (const mediaType of documentMediaTypes) {
      assert.equal(getProductMediaBucket(mediaType), productDocumentBucket);
    }
  });

  it("validates image MIME, extension, size, and empty files", () => {
    assert.deepEqual(validateProductMediaFile(imageFile, "exterior_image"), []);
    assert.ok(
      validateProductMediaFile(
        { name: "image.gif", size: 1, type: "image/gif" } as File,
        "exterior_image"
      ).includes("Image MIME type is not allowed.")
    );
    assert.ok(
      validateProductMediaFile(
        { name: "image.jpg", size: 10 * 1024 * 1024 + 1, type: "image/jpeg" } as File,
        "exterior_image"
      ).includes("Image file is too large. Maximum size is 10 MB.")
    );
    assert.ok(
      validateProductMediaFile(
        { name: "image.jpg", size: 0, type: "image/jpeg" } as File,
        "exterior_image"
      ).includes("Image file cannot be empty.")
    );
  });

  it("validates document MIME, extension, and size", () => {
    assert.deepEqual(validateProductMediaFile(documentFile, "specification_sheet"), []);
    assert.ok(
      validateProductMediaFile(
        { name: "spec.docx", size: 1, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as File,
        "specification_sheet"
      ).includes("Document MIME type is not allowed.")
    );
    assert.ok(
      validateProductMediaFile(
        { name: "spec.pdf", size: 25 * 1024 * 1024 + 1, type: "application/pdf" } as File,
        "specification_sheet"
      ).includes("Document file is too large. Maximum size is 25 MB.")
    );
  });

  it("builds public and private insert payload defaults", () => {
    const imagePayload = toProductMediaInsertPayload({
      productId: "22222222-2222-2222-2222-222222222222",
      manufacturerId: "11111111-1111-1111-1111-111111111111",
      file: imageFile,
      mediaType: "exterior_image",
      title: " Hero ",
      altText: " Front elevation ",
    });

    const documentPayload = toProductMediaInsertPayload({
      productId: "22222222-2222-2222-2222-222222222222",
      manufacturerId: "11111111-1111-1111-1111-111111111111",
      file: documentFile,
      mediaType: "specification_sheet",
      visibility: "public",
    });

    assert.equal(imagePayload.storage_bucket, productImageBucket);
    assert.equal(imagePayload.visibility, "public");
    assert.equal(imagePayload.title, "Hero");
    assert.equal(imagePayload.alt_text, "Front elevation");
    assert.equal(imagePayload.is_primary, false);
    assert.equal(documentPayload.storage_bucket, productDocumentBucket);
    assert.equal(documentPayload.visibility, "private");
  });

  it("keeps manufacturer editable media statuses narrow", () => {
    assert.equal(canEditProductMedia("draft"), true);
    assert.equal(canEditProductMedia("rejected"), true);
    assert.equal(canEditProductMedia("submitted"), false);
    assert.equal(canEditProductMedia("published"), false);
    assert.equal(canEditProductMedia("archived"), false);
  });

  it("maps storage and database errors to readable messages", () => {
    assert.equal(
      toReadableProductMediaError({ message: "new row violates row-level security policy" }).message,
      "You are not authorized to manage this product media."
    );
    assert.equal(
      toReadableProductMediaError({ message: "Product media storage path is not authorized" }).message,
      "The storage path is not authorized for this product."
    );
    assert.equal(
      toReadableProductMediaError({ code: "23505", message: "duplicate key value" }).message,
      "A media item already uses this storage path or primary slot."
    );
  });

  it("keeps generic metadata payloads away from primary image state", () => {
    const payload = toProductMediaMetadataPayload({
      title: "Updated",
      visibility: "private",
      is_primary: true,
    } as Parameters<typeof toProductMediaMetadataPayload>[0] & { is_primary: boolean });

    assert.deepEqual(payload, {
      title: "Updated",
      visibility: "private",
    });
    assert.equal("is_primary" in payload, false);
  });

  it("builds atomic primary image RPC arguments for the only primary-image operation", () => {
    assert.deepEqual(
      setPrimaryProductMediaRpcArgs(
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333"
      ),
      {
        product_uuid: "22222222-2222-2222-2222-222222222222",
        media_uuid: "33333333-3333-3333-3333-333333333333",
      }
    );
  });

  it("allows public signed image URLs only for public image projection rows", () => {
    const publicImage = {
      media_type: "exterior_image",
      storage_bucket: productImageBucket,
      visibility: "public",
    } as PublicProductMediaRecord;
    const privateImage = {
      media_type: "interior_image",
      storage_bucket: productImageBucket,
      visibility: "private",
    } as PublicProductMediaRecord;
    const publicDocument = {
      media_type: "specification_sheet",
      storage_bucket: productDocumentBucket,
      visibility: "public",
    } as PublicProductMediaRecord;
    const malformedPublicDocumentInImageBucket = {
      media_type: "catalog",
      storage_bucket: productImageBucket,
      visibility: "public",
    } as PublicProductMediaRecord;

    assert.equal(canRequestPublicSignedImageUrl(publicImage), true);
    assert.equal(canRequestPublicSignedImageUrl(privateImage), false);
    assert.equal(canRequestPublicSignedImageUrl(publicDocument), false);
    assert.equal(canRequestPublicSignedImageUrl(malformedPublicDocumentInImageBucket), false);
  });

  it("requests upload compensation cleanup only after metadata failure", () => {
    assert.equal(shouldRemoveUploadedObjectAfterMetadataFailure(true, false), true);
    assert.equal(shouldRemoveUploadedObjectAfterMetadataFailure(false, false), false);
    assert.equal(shouldRemoveUploadedObjectAfterMetadataFailure(true, true), false);
  });
});
