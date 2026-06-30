import { Project, ProjectId } from '@/types';

const STORAGE_KEY = 'omni_projects';
const STORAGE_VERSION = 1;

interface StorageData {
  version: number;
  projects: Project[];
  lastSync: number;
}

async function readStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const raw = result[STORAGE_KEY] as StorageData | undefined;
      if (!raw || raw.version !== STORAGE_VERSION) {
        resolve({ version: STORAGE_VERSION, projects: [], lastSync: Date.now() });
      } else {
        resolve(raw);
      }
    });
  });
}

async function writeStorage(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => resolve());
  });
}

export const StorageEngine = {
  async getAllProjects(): Promise<Project[]> {
    const data = await readStorage();
    return data.projects;
  },

  async getProjectById(id: ProjectId): Promise<Project | null> {
    const projects = await this.getAllProjects();
    return projects.find((p) => p.id === id) ?? null;
  },

  async saveProject(project: Project): Promise<void> {
    const data = await readStorage();
    const index = data.projects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      data.projects[index] = project;
    } else {
      data.projects.push(project);
    }
    data.lastSync = Date.now();
    await writeStorage(data);
  },

  async deleteProject(id: ProjectId): Promise<void> {
    const data = await readStorage();
    data.projects = data.projects.filter((p) => p.id !== id);
    data.lastSync = Date.now();
    await writeStorage(data);
  },

  async replaceAllProjects(projects: Project[]): Promise<void> {
    await writeStorage({
      version: STORAGE_VERSION,
      projects,
      lastSync: Date.now(),
    });
  },

  async export(): Promise<string> {
    const data = await readStorage();
    return JSON.stringify(data, null, 2);
  },

  async import(json: string): Promise<void> {
    const parsed = JSON.parse(json) as StorageData;
    if (parsed.version !== STORAGE_VERSION) {
      throw new Error(`Unsupported storage version: ${parsed.version}`);
    }
    await writeStorage(parsed);
  },
};
