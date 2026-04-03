# 트러블슈팅 이력

| 증상 | 원인 | 해결 |
|------|------|------|
| 네이버 API 401 GW.AUTHN | bcrypt 서명을 Bearer로 직접 사용 | OAuth2 2-step: /oauth2/token → access_token 발급 후 Bearer 사용 |
| `secretLength: 0` | .env.local에서 `$2a` 등이 env 변수로 해석됨 | `\$2a\$04\$...` 백슬래시 이스케이프 필수 |
| channel_orders FK 오류 | UI의 selectedBusinessId가 DB에 없는 UUID | adapter에서 UI 값 무시, businesses 테이블에서 직접 조회 |
| 네이버 API 400 날짜 오류 | UTC 형식 사용, 7일 범위 초과 | KST(+09:00) 형식 + 24h 단위 분할 쿼리 |
| 네이버 API 429 Rate Limit | 여러 날짜 구간을 연속 호출 | 구간 사이 600ms, 페이지 사이 300ms, 배치 사이 400ms 딜레이 |
| 동기화 성공 후 화면 미표시 | ordered_at 기준 7일 필터가 과거 주문 제외 | 기본 필터 90일로 변경, "전체 기간" 버튼 추가 |
| TS2802 Set 이터레이션 오류 | `[...new Set()]` — downlevelIteration 미설정 | for...of + seen Set 패턴으로 대체 |
| 로그인 후에도 데이터 0개 | Supabase가 새 테이블 생성 시 RLS 자동 활성화 + GRANT 미설정 | DB_SCHEMA.md의 RLS DISABLE 쿼리 실행 필수 |
| 헤더 채널 탭에 채널이 안 보임 | channels.business_id 컬럼 미존재 | `supabase/add_business_to_channels.sql` 실행 필요 |
| SlipFormModal 채널 목록 비어있음 | channels 테이블에 business_id가 없거나 해당 사업자 채널 미등록 | 마이그레이션 실행 후 /settings에서 채널 등록 |
