import { apiService } from './api.service';

export interface DataThing {
  id: number;
  name: string;
  photo: string;
  type: string;
  altNames: string;
}

export class DataService {
  async getThings(type: string): Promise<DataThing[]> {
    try {
      const url = `/data/things/${type}`;
      console.log(`DataService: Fetching from ${url}`);
      const things = await apiService.get<DataThing[]>(url);
      console.log(`DataService: Received ${things?.length || 0} things`, things);
      return things || [];
    } catch (error: any) {
      console.error(`DataService: Error fetching things of type "${type}":`, error);
      throw error;
    }
  }

  async addThing(name: string, type: string): Promise<DataThing> {
    return apiService.post<DataThing>('/data/things', {
      name,
      altNames: '',
      type,
    });
  }

  async searchOrganizations(query: string): Promise<any[]> {
    return apiService.get(`/data/organizations/search/${query}`);
  }

  async searchEducation(query: string): Promise<any[]> {
    return apiService.get(`/data/edu/search/${query}`);
  }

  async getSportsTeams(): Promise<any[]> {
    return apiService.get('/data/teams');
  }
}

export const dataService = new DataService();

