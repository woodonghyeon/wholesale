-- ── 사업자별 외부 API 설정 테이블 ──────────────────────────────────
-- 각 사업자마다 네이버, 텔레그램 등 외부 API 인증정보를 DB에 저장한다.
-- 환경변수(.env.local) 대신 사이트에서 직접 입력·관리 가능.
--
-- 실행: Supabase SQL Editor 에서 이 파일 전체를 실행하세요.

CREATE TABLE IF NOT EXISTS public.business_api_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider    text        NOT NULL,   -- 'naver_commerce' | 'telegram'
  credentials jsonb       NOT NULL DEFAULT '{}',
  -- naver_commerce: { client_id, client_secret }
  -- telegram:       { bot_token, chat_id }
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(business_id, provider)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_api_settings_updated_at ON public.business_api_settings;
CREATE TRIGGER business_api_settings_updated_at
  BEFORE UPDATE ON public.business_api_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS 설정 (서비스 롤만 접근 가능)
ALTER TABLE public.business_api_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.business_api_settings;
CREATE POLICY "service_role_all"
  ON public.business_api_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
