import { AlertTriangle, ShieldAlert, UserCheck } from "lucide-react"

export function SafetyBanner() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-amber-950 px-4 py-2"
      data-testid="banner-safety-warning"
    >
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm font-medium">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="font-bold">Research Use Only — Not for Clinical Decision-Making</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-amber-900 dark:text-amber-100">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            AI outputs may contain errors
          </span>
          <span className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Human verification required
          </span>
        </div>
      </div>
    </div>
  )
}
