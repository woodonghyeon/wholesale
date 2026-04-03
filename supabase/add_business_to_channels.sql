-- ============================================================
-- channels 테이블에 business_id 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. business_id 컬럼 추가 (nullable)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- 2. 기존 채널들을 첫 번째 사업자(본점)에 할당
--    (seed.sql로 생성된 채널들이 있는 경우 처리)
UPDATE channels
SET business_id = (
  SELECT id FROM businesses ORDER BY sort_order ASC LIMIT 1
)
WHERE business_id IS NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_channels_business ON channels(business_id);

-- 4. RLS 비활성화 유지 (다른 테이블과 동일하게)
ALTER TABLE channels DISABLE ROW LEVEL SECURITY;
