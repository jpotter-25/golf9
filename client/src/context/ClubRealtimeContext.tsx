// src/context/ClubRealtimeContext.tsx
// Purpose: Session-scoped club chat, presence, invitations, and notification badges.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import * as api from '../services/api';
import {
  connect,
  joinClubSocket,
  onClubChatMessage,
  onClubPresence,
  onClubUpdate,
  onMailUpdate,
  onSocialUpdate,
  sendClubChatMessage,
  updateClubPresence,
} from '../services/network';

type ClubRealtimeContextValue = {
  club: api.ClubProfile | null;
  applications: api.ClubApplication[];
  invitations: api.ClubInvitation[];
  recommended: api.ClubSummary[];
  mailSummary: api.MailSummary | null;
  chatMessages: api.ClubChatMessage[];
  clubChatUnread: number;
  clubActionCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  replaceClub: (club: api.ClubProfile | null) => void;
  updateMailSummary: (summary: api.MailSummary) => void;
  setClubChatVisible: (visible: boolean) => void;
  sendClubMessage: (text: string) => Promise<void>;
  acceptInvitation: (invitation: api.ClubInvitation) => Promise<void>;
  declineInvitation: (invitation: api.ClubInvitation) => Promise<void>;
};

const ClubRealtimeContext = createContext<ClubRealtimeContextValue | null>(null);

export function ClubRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, user, refreshProfile } = useAuth();
  const [club, setClub] = useState<api.ClubProfile | null>(null);
  const [applications, setApplications] = useState<api.ClubApplication[]>([]);
  const [invitations, setInvitations] = useState<api.ClubInvitation[]>([]);
  const [recommended, setRecommended] = useState<api.ClubSummary[]>([]);
  const [mailSummary, setMailSummary] = useState<api.MailSummary | null>(null);
  const [chatMessages, setChatMessages] = useState<api.ClubChatMessage[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const chatVisibleRef = useRef(false);
  const activeClubIdRef = useRef<string | null>(null);

  const replaceClub = useCallback((nextClub: api.ClubProfile | null) => {
    const nextId = nextClub?.clubId ?? null;
    if (activeClubIdRef.current !== nextId) {
      activeClubIdRef.current = nextId;
      setChatMessages([]);
      setUnreadIds([]);
    }
    setClub(nextClub);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [clubResponse, mailResponse] = await Promise.all([
        api.clubMe(token),
        api.mailSummary(token),
      ]);
      replaceClub(clubResponse.club);
      setApplications(clubResponse.applications ?? []);
      setInvitations(clubResponse.invitations ?? []);
      setRecommended(clubResponse.recommended ?? []);
      setMailSummary(mailResponse.summary);
      if (clubResponse.club) {
        const joined = await joinClubSocket(token, clubResponse.club.clubId);
        replaceClub(joined.club);
      }
    } finally {
      setLoading(false);
    }
  }, [replaceClub, token]);

  useEffect(() => {
    if (!token) {
      activeClubIdRef.current = null;
      setClub(null);
      setApplications([]);
      setInvitations([]);
      setRecommended([]);
      setMailSummary(null);
      setChatMessages([]);
      setUnreadIds([]);
      return undefined;
    }

    connect(token);
    void refresh().catch(() => {});

    const cleanupMessage = onClubChatMessage(message => {
      if (message.clubId !== activeClubIdRef.current) return;
      setChatMessages(previous => previous.some(item => item.id === message.id)
        ? previous
        : [...previous, message].slice(-80));
      if (!chatVisibleRef.current && message.userId !== user?.userId) {
        setUnreadIds(previous => previous.includes(message.id) ? previous : [...previous, message.id].slice(-99));
      }
    });
    const cleanupUpdate = onClubUpdate(update => {
      if (!update.club || update.clubId !== activeClubIdRef.current) return;
      replaceClub(update.club);
    });
    const cleanupPresence = onClubPresence(presence => {
      if (presence.clubId !== activeClubIdRef.current) return;
      const online = new Set(presence.onlineUserIds);
      setClub(previous => previous ? {
        ...previous,
        onlineMemberCount: presence.onlineMemberCount,
        members: previous.members.map(member => ({ ...member, isOnline: online.has(member.userId) })),
      } : previous);
    });
    const cleanupMail = onMailUpdate(setMailSummary);
    const cleanupSocial = onSocialUpdate(() => { void refresh().catch(() => {}); });

    return () => {
      cleanupMessage();
      cleanupUpdate();
      cleanupPresence();
      cleanupMail();
      cleanupSocial();
    };
  }, [refresh, replaceClub, token, user?.userId]);

  useEffect(() => {
    if (!token || !club?.clubId) return undefined;
    void updateClubPresence(token, AppState.currentState === 'active').catch(() => {});
    const subscription = AppState.addEventListener('change', state => {
      void updateClubPresence(token, state === 'active').catch(() => {});
      if (state === 'active') void refresh().catch(() => {});
    });
    return () => subscription.remove();
  }, [club?.clubId, refresh, token]);

  const setClubChatVisible = useCallback((visible: boolean) => {
    chatVisibleRef.current = visible;
    if (visible) setUnreadIds([]);
  }, []);

  const sendClubMessage = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!token || !club || !clean) return;
    await sendClubChatMessage(token, club.clubId, 'text', clean.slice(0, 160));
  }, [club, token]);

  const acceptInvitation = useCallback(async (invitation: api.ClubInvitation) => {
    if (!token) return;
    const response = await api.acceptClubInvitation(token, invitation);
    replaceClub(response.club);
    setInvitations(response.invitations ?? []);
    setApplications([]);
    await refreshProfile();
    await joinClubSocket(token, response.club.clubId);
  }, [refreshProfile, replaceClub, token]);

  const declineInvitation = useCallback(async (invitation: api.ClubInvitation) => {
    if (!token) return;
    const response = await api.declineClubInvitation(token, invitation);
    setInvitations(response.invitations ?? []);
  }, [token]);

  const clubActionCount = club?.permissions.canManageRequests
    ? club.joinRequests.length
    : invitations.length;

  const value = useMemo<ClubRealtimeContextValue>(() => ({
    club,
    applications,
    invitations,
    recommended,
    mailSummary,
    chatMessages,
    clubChatUnread: unreadIds.length,
    clubActionCount,
    loading,
    refresh,
    replaceClub,
    updateMailSummary: setMailSummary,
    setClubChatVisible,
    sendClubMessage,
    acceptInvitation,
    declineInvitation,
  }), [
    acceptInvitation,
    applications,
    chatMessages,
    club,
    clubActionCount,
    declineInvitation,
    invitations,
    loading,
    mailSummary,
    refresh,
    recommended,
    replaceClub,
    sendClubMessage,
    setClubChatVisible,
    unreadIds.length,
  ]);

  return <ClubRealtimeContext.Provider value={value}>{children}</ClubRealtimeContext.Provider>;
}

export function useClubRealtime() {
  const context = useContext(ClubRealtimeContext);
  if (!context) throw new Error('useClubRealtime must be used inside ClubRealtimeProvider');
  return context;
}
