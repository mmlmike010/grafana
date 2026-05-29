import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

export interface ExploreSessionDTO {
  uid: string;
  name: string;
  url: string;
  panes: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

type CreatePayload = {
  name: string;
  url: string;
  panes: Record<string, unknown>;
};

type ListResponse = {
  result: {
    sessions: ExploreSessionDTO[];
  };
};

type SessionResponse = {
  result: ExploreSessionDTO;
};

export async function listExploreSessions(): Promise<ExploreSessionDTO[]> {
  const res = await lastValueFrom(getBackendSrv().fetch<ListResponse>({ url: '/api/explore-sessions', method: 'GET' }));
  return res.data.result.sessions ?? [];
}

export async function createExploreSession(payload: CreatePayload): Promise<ExploreSessionDTO> {
  const res = await getBackendSrv().post<SessionResponse>('/api/explore-sessions', payload);
  return res.result;
}

export async function deleteExploreSession(uid: string): Promise<void> {
  await getBackendSrv().delete(`/api/explore-sessions/${uid}`);
}

export async function renameExploreSession(uid: string, name: string): Promise<ExploreSessionDTO> {
  const res = await getBackendSrv().patch<SessionResponse>(`/api/explore-sessions/${uid}`, { name });
  return res.result;
}
