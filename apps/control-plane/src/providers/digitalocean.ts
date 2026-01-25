// DigitalOcean API integration

const API_BASE = 'https://api.digitalocean.com/v2';

export interface DOSize {
    slug: string;
    memory: number;
    vcpus: number;
    disk: number;
    transfer: number;
    price_monthly: number;
    price_hourly: number;
    regions: string[];
    available: boolean;
    description: string;
}

export interface DORegion {
    slug: string;
    name: string;
    available: boolean;
    sizes: string[];
    features: string[];
}

export interface DODroplet {
    id: number;
    name: string;
    status: string;
    memory: number;
    vcpus: number;
    disk: number;
    networks: {
        v4: Array<{ ip_address: string; type: string }>;
        v6: Array<{ ip_address: string; type: string }>;
    };
    region: DORegion;
    size: DOSize;
    created_at: string;
}

export class DigitalOceanClient {
    private apiToken: string | null;

    constructor() {
        this.apiToken = process.env.DIGITALOCEAN_API_TOKEN || null;
    }

    isConfigured(): boolean {
        return !!this.apiToken;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.apiToken) throw new Error('DigitalOcean API token not configured');

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`DigitalOcean API error: ${response.status} - ${JSON.stringify(error)}`);
        }

        return response.json() as T;
    }

    async getSizes(): Promise<DOSize[]> {
        const result = await this.request<{ sizes: DOSize[] }>('/sizes');
        return result.sizes.filter(s => s.available);
    }

    async getRegions(): Promise<DORegion[]> {
        const result = await this.request<{ regions: DORegion[] }>('/regions');
        return result.regions.filter(r => r.available);
    }

    async createDroplet(options: {
        name: string;
        size: string;
        region: string;
        image?: string;
        sshKeys?: number[];
        userData?: string;
    }): Promise<DODroplet> {
        const result = await this.request<{ droplet: DODroplet }>('/droplets', {
            method: 'POST',
            body: JSON.stringify({
                name: options.name,
                size: options.size,
                region: options.region,
                image: options.image || 'ubuntu-22-04-x64',
                ssh_keys: options.sshKeys,
                user_data: options.userData,
                monitoring: true
            })
        });

        return result.droplet;
    }

    async getDroplet(dropletId: number): Promise<DODroplet> {
        const result = await this.request<{ droplet: DODroplet }>(`/droplets/${dropletId}`);
        return result.droplet;
    }

    async deleteDroplet(dropletId: number): Promise<void> {
        await this.request(`/droplets/${dropletId}`, { method: 'DELETE' });
    }

    async listDroplets(): Promise<DODroplet[]> {
        const result = await this.request<{ droplets: DODroplet[] }>('/droplets');
        return result.droplets;
    }

    async getSSHKeys(): Promise<Array<{ id: number; name: string; public_key: string }>> {
        const result = await this.request<{ ssh_keys: Array<{ id: number; name: string; public_key: string }> }>('/account/keys');
        return result.ssh_keys;
    }

    async createSSHKey(name: string, publicKey: string): Promise<{ id: number; name: string }> {
        const result = await this.request<{ ssh_key: { id: number; name: string } }>('/account/keys', {
            method: 'POST',
            body: JSON.stringify({ name, public_key: publicKey })
        });
        return result.ssh_key;
    }
}

export const digitalocean = new DigitalOceanClient();
