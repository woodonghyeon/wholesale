import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BusinessStore {
  selectedBusinessId: string // 'all' 또는 특정 business uuid
  setSelectedBusiness: (id: string) => void
}

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set) => ({
      selectedBusinessId: 'all',
      setSelectedBusiness: (id) => set({ selectedBusinessId: id }),
    }),
    { name: 'business-store' }
  )
)
