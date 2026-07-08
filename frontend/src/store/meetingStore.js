import { create } from 'zustand'

export const useMeetingStore = create((set) => ({
  meetingId: null,
  participantName: '',
  participants: [],
  joinPreferences: {
    audioEnabled: true,
    videoEnabled: true,
    audioDeviceId: '',
    videoDeviceId: '',
  },
  
  setMeetingId: (id) => set({ meetingId: id }),
  setParticipantName: (name) => set({ participantName: name }),
  setParticipants: (participants) => set({ participants }),
  setJoinPreferences: (joinPreferences) => set({ joinPreferences }),
  clearJoinPreferences: () => set({
    joinPreferences: {
      audioEnabled: true,
      videoEnabled: true,
      audioDeviceId: '',
      videoDeviceId: '',
    }
  }),
  
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (peerId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.peerId !== peerId),
    })),

  updateParticipant: (peerId, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.peerId === peerId ? { ...p, ...updates } : p
      ),
    })),
}))
