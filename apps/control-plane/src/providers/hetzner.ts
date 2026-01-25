// Hetzner Cloud API integration

const API_BASE = 'https://api.hetzner.cloud/v1';

export interface HetznerServerType {
    id: number;
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
    prices: Array<{
        location: string;
        price_hourly: { gross: string };
        price_monthly: { gross: string };
    }>;
}

export interface HetznerLocation {
    id: number;
    name: string;
    description: string;
    country: string;
    city: string;
}

export interface HetznerServer {
    id: number;
    name: string;
    status: string;
    public_net: {
        ipv4: { ip: string };
        ipv6: { ip: string };
    };
    server_type: HetznerServerType;
    datacenter: { location: HetznerLocation };
    created: string;
}

export class HetznerClient {
    private apiToken: string | null;

    constructor() {
        this.apiToken = process.env.HETZNER_API_TOKEN || null;
    }

    isConfigured(): boolean {
        return !!this.apiToken;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.apiToken) throw new Error('Hetzner API token not configured');

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
            throw new Error(`Hetzner API error: ${response.status} - ${JSON.stringify(error)}`);
        }

        return response.json() as T;
    }

    async getServerTypes(): Promise<HetznerServerType[]> {
        const result = await this.request<{ server_types: HetznerServerType[] }>('/server_types');
        return result.server_types;
    }

    async getLocations(): Promise<HetznerLocation[]> {
        const result = await this.request<{ locations: HetznerLocation[] }>('/locations');
        return result.locations;
    }

    async createServer(options: {
        name: string;
        serverType: string;
        location: string;
        image?: string;
        sshKeys?: string[];
        userData?: string;
    }): Promise<{ server: HetznerServer; rootPassword?: string }> {
        const result = await this.request<{ server: HetznerServer; root_password?: string }>('/servers', {
            method: 'POST',
            body: JSON.stringify({
                name: options.name,
                server_type: options.serverType,
                location: options.location,
                image: options.image || 'ubuntu-22.04',
                ssh_keys: options.sshKeys,
                user_data: options.userData,
                start_after_create: true
            })
        });

        return { server: result.server, rootPassword: result.root_password };
    }

    async getServer(serverId: number): Promise<HetznerServer> {
        const result = await this.request<{ server: HetznerServer }>(`/servers/${serverId}`);
        return result.server;
    }

    async deleteServer(serverId: number): Promise<void> {
        await this.request(`/servers/${serverId}`, { method: 'DELETE' });
    }

    async listServers(): Promise<HetznerServer[]> {
        const result = await this.request<{ servers: HetznerServer[] }>('/servers');
        return result.servers;
    }

    async getSSHKeys(): Promise<Array<{ id: number; name: string; public_key: string }>> {
        const result = await this.request<{ ssh_keys: Array<{ id: number; name: string; public_key: string }> }>('/ssh_keys');
        return result.ssh_keys;
    }

    async createSSHKey(name: string, publicKey: string): Promise<{ id: number; name: string }> {
        const result = await this.request<{ ssh_key: { id: number; name: string } }>('/ssh_keys', {
            method: 'POST',
            body: JSON.stringify({ name, public_key: publicKey })
        });
        return result.ssh_key;
    }
}

export const hetzner = new HetznerClient();
