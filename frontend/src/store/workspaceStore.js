import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWorkspaceStore = create(
  persist(
    (set) => ({
      activeWorkspace: 'personal', // 'personal' or organizationId
      organizations: [],

      setActiveWorkspace: (workspaceId) => set({ activeWorkspace: workspaceId }),
      
      setOrganizations: (organizations) => set({ organizations }),

      resetWorkspace: () => set({ activeWorkspace: 'personal', organizations: [] }),
    }),
    {
      name: 'workspace-storage',
    }
  )
)
