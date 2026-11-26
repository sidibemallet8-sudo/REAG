import { AiObservationProposal } from '../core/types';
import { AiProviderId, ReagProject } from '../types/reag';

export interface PreviewServiceState {
  running: boolean;
  projectId: string | null;
  projectName: string | null;
  port: number | null;
  url: string | null;
  startedAt: string | null;
  browserLaunchMessage: string | null;
  lastError: string | null;
}

export interface ServicesStatusPayload {
  localHost: {
    running: boolean;
    host: string;
    port: number | null;
    startedAt: string;
    dataDir: string;
    projectCount: number;
  };
  preview: PreviewServiceState;
  ai: {
    ollama: {
      installed: boolean;
      serviceRunning: boolean;
      baseUrl: string;
      models: string[];
      error: string | null;
    };
    gemini: {
      configured: boolean;
      model: string;
      message: string;
    };
    noAiModeAvailable: true;
    ramAdvisory: string;
  };
  system: {
    platform: string;
    nodeVersion: string;
    totalMemGb: number;
    freeMemGb: number;
    compatible8GbProfile: boolean;
  };
}

export interface AiProposalResponse {
  providerUsed: AiProviderId;
  modelUsed: string | null;
  proposals: AiObservationProposal[];
  disclaimer: string;
  rawValidated: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Erreur HTTP ${res.status}`);
  }
  return data;
}

export const LocalHostClient = {
  async getServicesStatus(): Promise<ServicesStatusPayload> {
    return fetchJson<ServicesStatusPayload>('/api/services/status');
  },

  async listProjects(): Promise<ReagProject[]> {
    const data = await fetchJson<{ projects: ReagProject[] }>('/api/projects');
    return data.projects;
  },

  async saveProject(project: ReagProject): Promise<ReagProject> {
    const data = await fetchJson<{ project: ReagProject }>(
      `/api/projects/${encodeURIComponent(project.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(project),
      }
    );
    return data.project;
  },

  async renameProject(projectId: string, name: string): Promise<ReagProject> {
    const data = await fetchJson<{ project: ReagProject }>(
      `/api/projects/${encodeURIComponent(projectId)}/rename`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }
    );
    return data.project;
  },

  async deleteProject(projectId: string): Promise<void> {
    await fetchJson<{ ok: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
  },

  async startPreview(projectId: string, openBrowser = false): Promise<PreviewServiceState> {
    const data = await fetchJson<{ preview: PreviewServiceState }>('/api/preview/start', {
      method: 'POST',
      body: JSON.stringify({ projectId, openBrowser }),
    });
    return data.preview;
  },

  async stopPreview(): Promise<PreviewServiceState> {
    const data = await fetchJson<{ preview: PreviewServiceState }>('/api/preview/stop', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return data.preview;
  },

  async testAiConnection(input: {
    provider: AiProviderId;
    model?: string;
  }): Promise<{
    ok: boolean;
    provider: AiProviderId;
    modelUsed: string | null;
    message: string;
  }> {
    return fetchJson('/api/ai/test', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async shutdownLocalHost(): Promise<{ ok: boolean; message: string }> {
    return fetchJson('/api/launcher/shutdown', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async requestAiProposals(input: {
    provider: AiProviderId;
    model?: string;
    projectName: string;
    notes: string;
  }): Promise<AiProposalResponse> {
    return fetchJson<AiProposalResponse>('/api/ai/propose', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
