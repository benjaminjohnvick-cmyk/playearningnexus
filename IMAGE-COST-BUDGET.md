# Image Cost Budget — the ~$10–15 One-Time Posture

This is the exact configuration to generate **all** catalog images once, for the whole 88-country
catalog, for about **$10–15 total** (one time). It is now the **default** in the code — you only need to
add your AWS credentials to activate it. If you don't add AWS creds, the catalog simply launches
**text-only at $0** and you can turn images on later.

## What gets generated (and why it's cheap)
- **~905 product images** — one original image per product. Thanks to the *template-once* design, that
  single image is reused across all 88 countries (only the flag/price change), so it is **not**
  multiplied by country.
- **~40 top-level department tile images** — subcategory tiles are OFF by default in this posture.
- **0 images for the ~21,700 browse nodes** — those are text, not images.
- **Total ≈ 945 images × ~$0.01 (Titan Image) ≈ $9–10 one-time** (headroom to ~$15).

If you later flip subcategory tiles on, add ~905 more images (~$9 more) for ~1,850 total (~$18).

## The exact settings (already the defaults)
Set these in the Railway Variables UI (or `backend/.env`). The first two plus AWS creds are all that's
strictly required — the rest already default to these values.

```
IMAGE_PROVIDER=aws_bedrock
IMAGE_MODEL=amazon.titan-image-generator-v1
CATALOG_IMAGES_ENABLED=1          # 0 = text-only launch at $0
CATALOG_IMAGES_MAX_PER_RUN=100    # paces cost across scheduled runs
CATALOG_SUBCATEGORY_IMAGES=0      # top-level tiles only (cheap). 1 = also ~905 subcategory tiles
CATALOG_IMAGE_SIZE=1024x1024

# AWS credentials that activate Bedrock (an IAM user with bedrock:InvokeModel):
AWS_REGION=us-east-1              # a region where Titan Image is enabled
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Also in the AWS console: open **Amazon Bedrock → Model access** and enable **Amazon Titan Image
Generator** in that region. Optional: set `S3_BUCKET` + `S3_PUBLIC_BASE` so images are stored as short
URLs instead of inline.

These are also editable live in **Admin → Platform Settings** (AI & Agents section) without a redeploy.

## How the cost stays bounded
- **Template-once:** an image is generated a single time and reused across every country — not per
  country (per-country would be ~$3,200; this posture is ~$10).
- **`CATALOG_IMAGES_MAX_PER_RUN=100`:** at most 100 images per scheduled run, so the ~945 fill over ~10
  runs — no single spike.
- **`CATALOG_SUBCATEGORY_IMAGES=0`:** skips the ~905 subcategory tiles you don't need at launch.
- **One-time:** once generated, images are reused forever; ongoing cost is only for new products you add.
- **Kill switch:** set `CATALOG_IMAGES_ENABLED=0` to launch text-only at $0 and backfill later.

## Cheaper / premium alternatives
- **Even cheaper:** self-host SDXL on a scale-to-zero SageMaker endpoint (`IMAGE_PROVIDER=aws_sagemaker`
  + `SAGEMAKER_IMAGE_ENDPOINT`) — roughly $0.002/image, so all images ≈ $2–8 plus a little warm time.
- **Premium look:** `IMAGE_MODEL=amazon.nova-canvas-v1:0` (~$0.04/image) → all images ≈ $40–75.

> AWS list prices change; confirm the current Bedrock image pricing before a large run. The image
> *count* above comes directly from this app's catalog settings.
