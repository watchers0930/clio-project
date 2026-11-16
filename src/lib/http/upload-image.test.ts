import { test } from "node:test";
import assert from "node:assert/strict";
import { readUploadImage, UPLOAD_IMAGE_MAX_BYTES } from "./upload-image";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

test("실제 내용으로 형식·확장자를 정한다(브라우저가 보낸 type 은 무시)", async () => {
  const r = await readUploadImage(new File([PNG], "a.jpg", { type: "image/jpeg" }));
  assert.equal(r.ok && r.mime, "image/png");
  assert.equal(r.ok && r.ext, "png");
  assert.equal((await readUploadImage(new Blob([JPG]))).ok && "jpg", "jpg");
  const w = await readUploadImage(new Blob([WEBP]));
  assert.equal(w.ok && w.ext, "webp");
});

test("이미지로 위장한 HTML·SVG 는 거부", async () => {
  assert.equal((await readUploadImage(new File(["<html><script>x</script>"], "s.png", { type: "image/png" }))).ok, false);
  assert.equal((await readUploadImage(new File(["<svg onload=x>"], "s.webp", { type: "image/webp" }))).ok, false);
});

test("파일 없음·빈 파일·2MB 초과는 거부", async () => {
  assert.equal((await readUploadImage(null)).ok, false);
  assert.equal((await readUploadImage("x")).ok, false);
  assert.equal((await readUploadImage(new Blob([]))).ok, false);
  assert.equal((await readUploadImage(new Blob([PNG, Buffer.alloc(UPLOAD_IMAGE_MAX_BYTES)]))).ok, false);
});
