import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BusinessStore {
  selectedBusinessId: string
  selectedChannelId: string
  setSelectedBusiness: (id: string) => void
  setSelectedChannel: (id: string) => void
}

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set) => ({
      selectedBusinessId: 'all',
      selectedChannelId: 'all',
      setSelectedBusiness: (id) => set({ selectedBusinessId: id, selectedChannelId: 'all' }),
      setSelectedChannel: (id) => set({ selectedChannelId: id }),
    }),
    {
      name: 'business-store',
    }
  )
)
