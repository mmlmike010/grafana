import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

export type ExploreSessionDTO = {
  uid: string;
  name: string;
  url: string;
  panesJson: string;
  createdAt: number;
  updatedAt: number;
};

type ExploreSessionResponseDTO = {
  result: ExploreSessionDTO;
};

type ExploreSessionSearchResponseDTO = {
  result: {
    totalCount: number;
    sessions: ExploreSessionDTO[];
    page: number;
    perPage: number;
  };
};

export type CreateExploreSessionPayload = {
  name: string;
  url: string;
  panesJson: string;
};

export async function createExploreSession(payload: CreateExploreSessionPayload): Promise<ExploreSessionDTO> {
  const { result } = await getBackendSrv().post<ExploreSessionResponseDTO>('/api/explore-sessions', payload);
  return result;
}

export async function listExploreSessions(
  searchString = '',
  page = 1,
  limit = 100
): Promise<{
  sessions: ExploreSessionDTO[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (searchString) {
    params.set('searchString', searchString);
  }
  params.set('page', String(page));
  params.set('limit', String(limit));

  const response = await lastValueFrom(
    getBackendSrv().fetch<ExploreSessionSearchResponseDTO>({
      method: 'GET',
      url: `/api/explore-sessions?${params.toString()}`,
      requestId: 'explore-sessions-list',
    })
  );

  return {
    sessions: response.data.result.sessions || [],
    totalCount: response.data.result.totalCount || 0,
  };
}

export async function getExploreSession(uid: string): Promise<ExploreSessionDTO> {
  const { result } = await getBackendSrv().get<ExploreSessionResponseDTO>(`/api/explore-sessions/${uid}`);
  return result;
}

export async function deleteExploreSession(uid: string): Promise<void> {
  await getBackendSrv().delete(`/api/explore-sessions/${uid}`);
}

export async function renameExploreSession(uid: string, name: string): Promise<ExploreSessionDTO> {
  const { result } = await getBackendSrv().patch<ExploreSessionResponseDTO>(`/api/explore-sessions/${uid}`, { name });
  return result;
}
