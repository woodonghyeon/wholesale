'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getBusinesses, upsertBusiness, deleteBusiness } from '@/lib/supabase/businesses'
import { getChannels, upsertChannel, deleteChannel } from '@/lib/supabase/channels'
import { getWarehouses, upsertWarehouse, deleteWarehouse } from '@/lib/supabase/warehouses'
import { Business, Channel, Warehouse } from '@/lib/types'

type Tab = 'businesses' | 'channels' | 'warehouses' | 'integrations'

// ── API 설정 타입 ────────────────────────────────────────────────
interface ApiKeyRecord {
  business_id: string
  provider: string
  credentials: Record<string, string>
  is_active: boolean
  updated_at: string
}

interface ApiKeyForm {
  businessId: string
  provider: 'naver_commerce' | 'telegram'
  clientId: string
  clientSecret: string
  botToken: string
  chatId: string
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('businesses')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  // 레거시 env 연결 테스트
  const [naverStatus, setNaverStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [naverError, setNaverError] = useState<string | null>(null)
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const [envConfig, setEnvConfig] = useState<{ naver: { configured: boolean }; telegram: { configured: boolean } } | null>(null)

  // 사업자별 API 키
  const [apiSettings, setApiSettings] = useState<ApiKeyRecord[]>([])
  const [apiKeyModal, setApiKeyModal] = useState(false)
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyForm>({
    businessId: '', provider: 'naver_commerce',
    clientId: '', clientSecret: '', botToken: '', chatId: '',
  })
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyTesting, setApiKeyTesting] = useState<string | null>(null)  // businessId_provider

  const loadApiSettings = useCallback(async () => {
    try {
      const [keyRes, envRes] = await Promise.all([
        fetch('/api/settings/api-keys'),
        fetch('/api/settings/env-check'),
      ])
      const keyData = await keyRes.json()
      const envData = await envRes.json()
      if (keyData.success) setApiSettings(keyData.settings)
      setEnvConfig(envData)
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => {
    if (tab === 'integrations') loadApiSettings()
  }, [tab, loadApiSettings])

  function openApiKeyModal(bizId: string, provider: 'naver_commerce' | 'telegram') {
    const existing = apiSettings.find(s => s.business_id === bizId && s.provider === provider)
    setApiKeyForm({
      businessId: bizId,
      provider,
      clientId: provider === 'naver_commerce' ? (existing?.credentials?.client_id ?? '') : '',
      clientSecret: '',  // 보안상 비워둠
      botToken: provider === 'telegram' ? (existing?.credentials?.bot_token ?? '') : '',
      chatId: provider === 'telegram' ? (existing?.credentials?.chat_id ?? '') : '',
    })
    setApiKeyModal(true)
  }

  async function saveApiKey() {
    const { businessId, provider, clientId, clientSecret, botToken, chatId } = apiKeyForm
    if (!businessId) return toast.error('사업자를 선택해주세요')

    // 기존 등록 여부 확인 (수정이면 secret 빈 값 허용, 신규이면 필수)
    const isExisting = apiSettings.some(s => s.business_id === businessId && s.provider === provider)

    let credentials: Record<string, string> = {}
    if (provider === 'naver_commerce') {
      if (!clientId) return toast.error('Client ID를 입력해주세요')
      if (!isExisting && !clientSecret) return toast.error('Client Secret을 입력해주세요 (신규 등록 시 필수)')
      credentials = { client_id: clientId }
      if (clientSecret) credentials.client_secret = clientSecret
      // clientSecret이 비어있으면 API 라우트에서 기존 값 유지 처리됨
    } else {
      if (!botToken) return toast.error('Bot Token을 입력해주세요')
      credentials = { bot_token: botToken, chat_id: chatId }
    }

    setApiKeySaving(true)
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, provider, credentials }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('API 키가 저장되었습니다')
      setApiKeyModal(false)
      loadApiSettings()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setApiKeySaving(false)
    }
  }

  async function deleteApiKey(bizId: string, provider: string) {
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: bizId, provider }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('API 키가 삭제되었습니다')
      loadApiSettings()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  async function testNaverApiKey(bizId: string) {
    const key = `${bizId}_naver_commerce`
    setApiKeyTesting(key)
    try {
      const res = await fetch(`/api/naver/test?business_id=${bizId}`)
      const data = await res.json()
      if (data.success) toast.success('네이버 API 연결 성공!')
      else toast.error(data.error ?? '연결 실패', { duration: 6000 })
    } catch {
      toast.error('연결 테스트 중 오류가 발생했습니다')
    } finally {
      setApiKeyTesting(null)
    }
  }

  async function testTelegramApiKey(bizId: string) {
    const key = `${bizId}_telegram`
    setApiKeyTesting(key)
    try {
      const res = await fetch(`/api/telegram/test?business_id=${bizId}`)
      const data = await res.json()
      if (data.success) toast.success('텔레그램 메시지 전송 성공! 봇 채팅을 확인해주세요.')
      else toast.error(data.error ?? '연결 실패', { duration: 6000 })
    } catch {
      toast.error('연결 테스트 중 오류가 발생했습니다')
    } finally {
      setApiKeyTesting(null)
    }
  }

  async function checkTelegramConnection() {
    setTelegramStatus('checking')
    setTelegramError(null)
    try {
      const res = await fetch('/api/telegram/test')
      const data = await res.json()
      if (data.success) setTelegramStatus('ok')
      else { setTelegramStatus('error'); setTelegramError(data.error ?? '연결 실패') }
    } catch (e: unknown) {
      setTelegramStatus('error')
      setTelegramError((e as Error).message)
    }
  }

  async function checkNaverConnection() {
    setNaverStatus('checking')
    setNaverError(null)
    try {
      const res = await fetch('/api/naver/test')
      const data = await res.json()
      if (data.success) {
        setNaverStatus('ok')
      } else {
        setNaverStatus('error')
        setNaverError(data.error ?? '연결 실패')
      }
    } catch (e: unknown) {
      setNaverStatus('error')
      setNaverError((e as Error).message)
    }
  }

  // 모달 상태
  const [bizModal, setBizModal] = useState(false)
  const [chModal, setChModal] = useState(false)
  const [whModal, setWhModal] = useState(false)
  const [editBiz, setEditBiz] = useState<Partial<Business>>({})
  const [editCh, setEditCh] = useState<Partial<Channel>>({})
  const [editWh, setEditWh] = useState<Partial<Warehouse>>({})
  const [confirmId, setConfirmId] = useState<{ type: Tab; id: string } | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [b, c, w] = await Promise.all([getBusinesses(), getChannels(), getWarehouses()])
      setBusinesses(b); setChannels(c); setWarehouses(w)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setLoading(false) }
  }

  // ── 사업자 ──
  async function saveBusiness() {
    if (!editBiz.name?.trim()) return toast.error('사업자명을 입력해주세요')
    try {
      await upsertBusiness(editBiz as Business & { name: string })
      toast.success('저장되었습니다')
      setBizModal(false); setEditBiz({})
      const b = await getBusinesses(); setBusinesses(b)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 채널 ──
  async function saveChannel() {
    if (!editCh.name?.trim()) return toast.error('채널명을 입력해주세요')
    try {
      await upsertChannel(editCh as Channel & { name: string })
      toast.success('저장되었습니다')
      setChModal(false); setEditCh({})
      const c = await getChannels(); setChannels(c)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 창고 ──
  async function saveWarehouse() {
    if (!editWh.name?.trim()) return toast.error('창고명을 입력해주세요')
    try {
      await upsertWarehouse(editWh as Warehouse & { name: string })
      toast.success('저장되었습니다')
      setWhModal(false); setEditWh({})
      const w = await getWarehouses(); setWarehouses(w)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      if (confirmId.type === 'businesses') { await deleteBusiness(confirmId.id); setBusinesses(await getBusinesses()) }
      if (confirmId.type === 'channels') { await deleteChannel(confirmId.id); setChannels(await getChannels()) }
      if (confirmId.type === 'warehouses') { await deleteWarehouse(confirmId.id); setWarehouses(await getWarehouses()) }
      toast.success('삭제되었습니다')
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'businesses', label: '사업자' },
    { key: 'channels', label: '판매채널' },
    { key: 'warehouses', label: '창고' },
    { key: 'integrations', label: '외부 연동' },
  ]

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      <PageHeader title="설정" description="사업자·채널·창고 기준 정보 관리" />

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-gray-400">불러오는 중...</p> : (
        <>
          {/* ── 사업자 ── */}
          {tab === 'businesses' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditBiz({}); setBizModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 사업자 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['사업자명','사업자번호','대표자','전화','이메일',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {businesses.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">사업자가 없습니다</td></tr>
                    )}
                    {businesses.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{b.name}</td>
                        <td className="px-4 py-3 text-gray-500">{b.business_no ?? '-'}</td>
                        <td className="px-4 py-3">{b.owner_name ?? '-'}</td>
                        <td className="px-4 py-3">{b.phone ?? '-'}</td>
                        <td className="px-4 py-3">{b.email ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditBiz(b); setBizModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'businesses', id: b.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 채널 ── */}
          {tab === 'channels' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditCh({}); setChModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 채널 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['채널명','플랫폼 수수료(%)','결제 수수료(%)','기본 배송비',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {channels.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">채널이 없습니다</td></tr>
                    )}
                    {channels.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">{c.commission_rate}%</td>
                        <td className="px-4 py-3">{c.payment_fee_rate}%</td>
                        <td className="px-4 py-3">{c.shipping_fee.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditCh(c); setChModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'channels', id: c.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 창고 ── */}
          {tab === 'warehouses' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditWh({}); setWhModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 창고 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['창고명','사업자','주소','메모',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {warehouses.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">창고가 없습니다</td></tr>
                    )}
                    {warehouses.map(w => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-gray-500">{businesses.find(b => b.id === w.business_id)?.name ?? <span className="text-gray-300">-</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{w.address ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{w.note ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditWh(w); setWhModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'warehouses', id: w.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 외부 연동 ── */}
          {tab === 'integrations' && (
            <div className="space-y-6">

              {/* ── 사업자별 API 키 관리 ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">사업자별 API 키 관리</h3>
                    <p className="text-xs text-gray-500 mt-0.5">각 사업자마다 네이버·텔레그램 API 인증 정보를 개별 등록하세요</p>
                  </div>
                </div>

                {businesses.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
                    먼저 사업자를 등록해주세요
                  </div>
                ) : (
                  <div className="space-y-3">
                    {businesses.map(biz => {
                      const naverSetting = apiSettings.find(s => s.business_id === biz.id && s.provider === 'naver_commerce')
                      const telegramSetting = apiSettings.find(s => s.business_id === biz.id && s.provider === 'telegram')
                      return (
                        <div key={biz.id} className="bg-white rounded-xl border border-gray-100 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">
                              {biz.name.slice(0, 1)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{biz.name}</p>
                              {biz.business_no && <p className="text-xs text-gray-400">{biz.business_no}</p>}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* 네이버 Commerce */}
                            <div className={`rounded-lg border p-3 ${naverSetting ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-green-700">N</span>
                                  <span className="text-sm font-medium text-gray-700">네이버 스마트스토어</span>
                                </div>
                                {naverSetting
                                  ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">등록됨</span>
                                  : <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">미등록</span>
                                }
                              </div>
                              {naverSetting && (
                                <p className="text-xs text-gray-500 mb-2">
                                  Client ID: <code className="bg-white px-1 rounded">{naverSetting.credentials.client_id ?? '(숨김)'}</code>
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openApiKeyModal(biz.id, 'naver_commerce')}
                                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white bg-white text-gray-700"
                                >
                                  {naverSetting ? '수정' : '+ 등록'}
                                </button>
                                {naverSetting && (
                                  <>
                                    <button
                                      onClick={() => testNaverApiKey(biz.id)}
                                      disabled={apiKeyTesting === `${biz.id}_naver_commerce`}
                                      className="flex-1 px-2 py-1.5 text-xs border border-green-200 rounded-lg hover:bg-green-100 text-green-700 disabled:opacity-50"
                                    >
                                      {apiKeyTesting === `${biz.id}_naver_commerce` ? '테스트 중...' : '연결 테스트'}
                                    </button>
                                    <button
                                      onClick={() => deleteApiKey(biz.id, 'naver_commerce')}
                                      className="px-2 py-1.5 text-xs border border-red-100 rounded-lg hover:bg-red-50 text-red-500"
                                    >
                                      삭제
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 텔레그램 */}
                            <div className={`rounded-lg border p-3 ${telegramSetting ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-blue-600">T</span>
                                  <span className="text-sm font-medium text-gray-700">텔레그램 알림</span>
                                </div>
                                {telegramSetting
                                  ? <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">등록됨</span>
                                  : <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">미등록</span>
                                }
                              </div>
                              {telegramSetting && (
                                <p className="text-xs text-gray-500 mb-2">
                                  Bot Token: <code className="bg-white px-1 rounded">{telegramSetting.credentials.bot_token ?? '(숨김)'}</code>
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openApiKeyModal(biz.id, 'telegram')}
                                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white bg-white text-gray-700"
                                >
                                  {telegramSetting ? '수정' : '+ 등록'}
                                </button>
                                {telegramSetting && (
                                  <>
                                    <button
                                      onClick={() => testTelegramApiKey(biz.id)}
                                      disabled={apiKeyTesting === `${biz.id}_telegram`}
                                      className="flex-1 px-2 py-1.5 text-xs border border-blue-200 rounded-lg hover:bg-blue-100 text-blue-700 disabled:opacity-50"
                                    >
                                      {apiKeyTesting === `${biz.id}_telegram` ? '전송 중...' : '테스트 전송'}
                                    </button>
                                    <button
                                      onClick={() => deleteApiKey(biz.id, 'telegram')}
                                      className="px-2 py-1.5 text-xs border border-red-100 rounded-lg hover:bg-red-50 text-red-500"
                                    >
                                      삭제
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── 레거시 env 연결 상태 ── */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-700 text-sm">환경변수(.env.local) 연결 상태</h3>
                </div>
                <p className="text-xs text-gray-400 mb-1">위 사업자별 API 키가 없을 때 환경변수를 폴백으로 사용합니다</p>
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mb-3">
                  ⚠️ .env.local 수정 후에는 <strong>개발 서버 재시작</strong>(npm run dev 재실행)이 필요합니다
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 네이버 env */}
                  <div className={`bg-white rounded-xl border p-4 ${
                    envConfig ? (envConfig.naver.configured ? 'border-green-200' : 'border-gray-100 opacity-60') : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-sm font-bold text-green-700">N</div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">네이버 (env)</p>
                          <p className="text-xs text-gray-400">NAVER_COMMERCE_CLIENT_ID/SECRET</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {envConfig && (
                          envConfig.naver.configured
                            ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">값 있음</span>
                            : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">미설정</span>
                        )}
                        {naverStatus === 'ok' && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">연결됨</span>}
                        {naverStatus === 'error' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">실패</span>}
                        <button
                          onClick={checkNaverConnection}
                          disabled={naverStatus === 'checking' || (envConfig != null && !envConfig.naver.configured)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          {naverStatus === 'checking' ? '확인 중...' : '테스트'}
                        </button>
                      </div>
                    </div>
                    {naverError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{naverError}</p>}
                    {envConfig && !envConfig.naver.configured && (
                      <p className="text-xs text-gray-400">env 미설정 — 위 사업자별 API 키를 사용합니다</p>
                    )}
                  </div>

                  {/* 텔레그램 env */}
                  <div className={`bg-white rounded-xl border p-4 ${
                    envConfig ? (envConfig.telegram.configured ? 'border-blue-200' : 'border-gray-100 opacity-60') : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">T</div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">텔레그램 (env)</p>
                          <p className="text-xs text-gray-400">TELEGRAM_BOT_TOKEN/CHAT_ID</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {envConfig && (
                          envConfig.telegram.configured
                            ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">값 있음</span>
                            : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">미설정</span>
                        )}
                        {telegramStatus === 'ok' && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">연결됨</span>}
                        {telegramStatus === 'error' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">실패</span>}
                        <button
                          onClick={checkTelegramConnection}
                          disabled={telegramStatus === 'checking' || (envConfig != null && !envConfig.telegram.configured)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          {telegramStatus === 'checking' ? '확인 중...' : '테스트'}
                        </button>
                      </div>
                    </div>
                    {telegramError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{telegramError}</p>}
                    {envConfig && !envConfig.telegram.configured && (
                      <p className="text-xs text-gray-400">env 미설정 — 위 사업자별 API 키를 사용합니다</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 미연동 서비스 */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">준비 중인 연동</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { name: '쿠팡 파트너스', desc: '쿠팡 주문 연동' },
                    { name: '카카오 알림톡', desc: '주문·입금 알림 발송' },
                    { name: '홈택스', desc: '전자세금계산서 연동' },
                  ].map(svc => (
                    <div key={svc.name} className="bg-white rounded-xl border border-gray-100 p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-700 text-sm">{svc.name}</p>
                          <p className="text-xs text-gray-400">{svc.desc}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">준비 중</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 사업자 모달 ── */}
      <Modal open={bizModal} onClose={() => setBizModal(false)} title={editBiz.id ? '사업자 수정' : '사업자 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>사업자명 *</label>
            <input className={inputCls} value={editBiz.name ?? ''} onChange={e => setEditBiz(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={labelCls}>사업자등록번호</label>
            <input className={inputCls} placeholder="000-00-00000" value={editBiz.business_no ?? ''} onChange={e => setEditBiz(p => ({ ...p, business_no: e.target.value }))} /></div>
          <div><label className={labelCls}>대표자명</label>
            <input className={inputCls} value={editBiz.owner_name ?? ''} onChange={e => setEditBiz(p => ({ ...p, owner_name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>전화</label>
              <input className={inputCls} value={editBiz.phone ?? ''} onChange={e => setEditBiz(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className={labelCls}>이메일</label>
              <input className={inputCls} value={editBiz.email ?? ''} onChange={e => setEditBiz(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>주소</label>
            <input className={inputCls} value={editBiz.address ?? ''} onChange={e => setEditBiz(p => ({ ...p, address: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setBizModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveBusiness} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* ── 채널 모달 ── */}
      <Modal open={chModal} onClose={() => setChModal(false)} title={editCh.id ? '채널 수정' : '채널 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>채널명 *</label>
            <input className={inputCls} value={editCh.name ?? ''} onChange={e => setEditCh(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>플랫폼 수수료 (%)</label>
              <input type="number" step="0.01" className={inputCls} value={editCh.commission_rate ?? 0} onChange={e => setEditCh(p => ({ ...p, commission_rate: parseFloat(e.target.value) }))} /></div>
            <div><label className={labelCls}>결제 수수료 (%)</label>
              <input type="number" step="0.01" className={inputCls} value={editCh.payment_fee_rate ?? 0} onChange={e => setEditCh(p => ({ ...p, payment_fee_rate: parseFloat(e.target.value) }))} /></div>
          </div>
          <div><label className={labelCls}>기본 배송비 (원)</label>
            <input type="number" className={inputCls} value={editCh.shipping_fee ?? 0} onChange={e => setEditCh(p => ({ ...p, shipping_fee: parseInt(e.target.value) }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setChModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveChannel} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* ── 창고 모달 ── */}
      <Modal open={whModal} onClose={() => setWhModal(false)} title={editWh.id ? '창고 수정' : '창고 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>창고명 *</label>
            <input className={inputCls} value={editWh.name ?? ''} onChange={e => setEditWh(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={labelCls}>사업자</label>
            <select className={inputCls} value={editWh.business_id ?? ''} onChange={e => setEditWh(p => ({ ...p, business_id: e.target.value || null }))}>
              <option value="">선택 안 함 (공통 창고)</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>주소</label>
            <input className={inputCls} value={editWh.address ?? ''} onChange={e => setEditWh(p => ({ ...p, address: e.target.value }))} /></div>
          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editWh.note ?? ''} onChange={e => setEditWh(p => ({ ...p, note: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setWhModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveWarehouse} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        message="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />

      {/* ── API 키 등록/수정 모달 ── */}
      <Modal
        open={apiKeyModal}
        onClose={() => setApiKeyModal(false)}
        title={apiKeyForm.provider === 'naver_commerce' ? '네이버 Commerce API 키' : '텔레그램 봇 설정'}
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>사업자</label>
            <select
              className={inputCls}
              value={apiKeyForm.businessId}
              onChange={e => setApiKeyForm(p => ({ ...p, businessId: e.target.value }))}
            >
              <option value="">사업자 선택</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>연동 서비스</label>
            <select
              className={inputCls}
              value={apiKeyForm.provider}
              onChange={e => setApiKeyForm(p => ({ ...p, provider: e.target.value as 'naver_commerce' | 'telegram' }))}
            >
              <option value="naver_commerce">네이버 스마트스토어</option>
              <option value="telegram">텔레그램 알림</option>
            </select>
          </div>

          {apiKeyForm.provider === 'naver_commerce' && (
            <>
              <div>
                <label className={labelCls}>Client ID <span className="text-red-500">*</span></label>
                <input
                  className={inputCls}
                  placeholder="네이버 Commerce API Client ID"
                  value={apiKeyForm.clientId}
                  onChange={e => setApiKeyForm(p => ({ ...p, clientId: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Client Secret{' '}
                  {apiSettings.some(s => s.business_id === apiKeyForm.businessId && s.provider === 'naver_commerce')
                    ? <span className="text-xs text-gray-400 font-normal">(변경 없으면 비워두세요 — 기존 값 유지)</span>
                    : <><span className="text-red-500">*</span><span className="text-xs text-gray-400 font-normal ml-1">(신규 등록 시 필수)</span></>
                  }
                </label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={apiKeyForm.clientSecret}
                  onChange={e => setApiKeyForm(p => ({ ...p, clientSecret: e.target.value }))}
                />
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">네이버 Commerce API 발급 방법</p>
                <p>1. 네이버 스마트스토어 센터 로그인</p>
                <p>2. 판매자 정보 → API 신청 → 애플리케이션 등록</p>
                <p>3. 권한 범위: 상품, 주문, 클레임 선택</p>
                <p>4. Client ID / Client Secret 복사하여 입력</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-3 py-2.5 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">⚠️ Client Secret 입력 주의 (한국어 Windows)</p>
                <p>Client Secret은 <code className="bg-amber-100 px-1 rounded font-mono">$2a$10$...</code> 형태의 bcrypt 문자열입니다.</p>
                <p>한국어 키보드에서 <code className="bg-amber-100 px-1 rounded font-mono">₩</code>이 <code className="bg-amber-100 px-1 rounded font-mono">$</code> 대신 입력될 수 있습니다 — 자동 보정이 적용됩니다.</p>
                <p>.env.local 파일에서 직접 복사하여 붙여넣기 하는 것을 권장합니다.</p>
              </div>
            </>
          )}

          {apiKeyForm.provider === 'telegram' && (
            <>
              <div>
                <label className={labelCls}>Bot Token <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="123456:ABC-DEF..."
                  value={apiKeyForm.botToken}
                  onChange={e => setApiKeyForm(p => ({ ...p, botToken: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Chat ID</label>
                <input
                  className={inputCls}
                  placeholder="-100123456789"
                  value={apiKeyForm.chatId}
                  onChange={e => setApiKeyForm(p => ({ ...p, chatId: e.target.value }))}
                />
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">텔레그램 봇 설정 방법</p>
                <p>1. 텔레그램에서 @BotFather 검색 → /newbot 명령</p>
                <p>2. 봇 이름 설정 후 Bot Token 발급</p>
                <p>3. 봇에게 메시지 전송 후 아래 URL에서 Chat ID 확인:</p>
                <p><code className="bg-blue-100 px-1 rounded">api.telegram.org/bot{'<TOKEN>'}/getUpdates</code></p>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setApiKeyModal(false)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={saveApiKey}
              disabled={apiKeySaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {apiKeySaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
