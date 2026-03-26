import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="no-print print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="no-print print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-6 print-area print:overflow-visible print:h-auto">{children}</main>
      </div>
    </div>
  )
}
