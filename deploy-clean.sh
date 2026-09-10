#!/bin/bash
# deploy-clean.sh - Clean deploy สำหรับ Next.js + Cloudflare

echo "🧹 ลบ build artifacts เก่า..."
rm -rf .next .open-next

echo "🚀 รัน deploy pipeline..."
npm run deploy
