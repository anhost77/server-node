// Vultr API integration

const API_BASE = 'https://api.vultr.com/v2';

export interface VultrPlan {
    id: string;
    vcpu_count: number;
    ram: number;
    disk: number;
    bandwidth: number;
    monthly_cost: number;
    type: string;
    locations: string[];
}

export interface VultrRegion {
    id: string;
    city: string;
    country: string;
    continent: string;
    options: string[];
}

export interface VultrInstance {
    id: string;
    main_ip: string;
    vcpu_count: number;
    ram: number;
    disk: number;
    status: string;
    power_status: string;
    server_status: string;
    region: string;
    plan: string;
    date_created: string;
    label: string;
    v6_main_ip: string;
}

export class VultrClient {
    private apiKey: string | null;

    constructor() {
        this.apiKey = process.env.VULTR_API_KEY || null;
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.apiKey) throw new Error('Vultr API key not configured');

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Vultr API error: ${response.status} - ${JSON.stringify(error)}`);
        }

        // DELETE requests may not return content
        if (response.status === 204) return {} as T;

        return response.json() as T;
    }

    async getPlans(): Promise<VultrPlan[]> {
        const result = await this.request<{ plans: VultrPlan[] }>('/plans');
        return result.plans;
    }

    async getRegions(): Promise<VultrRegion[]> {
        const result = await this.request<{ regions: VultrRegion[] }>('/regions');
        return result.regions;
    }

    async createInstance(options: {
        label: string;
        plan: string;
        region: string;
        osId?: number;
        sshKeyIds?: string[];
        userData?: string;
    }): Promise<VultrInstance> {
        const result = await this.request<{ instance: VultrInstance }>('/instances', {
            method: 'POST',
            body: JSON.stringify({
                label: options.label,
                plan: options.plan,
                region: options.region,
                os_id: options.osId || 1743, // Ubuntu 22.04 LTS x64
                sshkey_id: options.sshKeyIds,
                user_data: options.userData ? Buffer.from(options.userData).toString('base64') : undefined,
                enable_ipv6: true
            })
        });

        return result.instance;
    }

    async getInstance(instanceId: string): Promise<VultrInstance> {
        const result = await this.request<{ instance: VultrInstance }>(`/instances/${instanceId}`);
        return result.instance;
    }

    async deleteInstance(instanceId: string): Promise<void> {
        await this.request(`/instances/${instanceId}`, { method: 'DELETE' });
    }

    async listInstances(): Promise<VultrInstance[]> {
        const result = await this.request<{ instances: VultrInstance[] }>('/instances');
        return result.instances;
    }

    async getSSHKeys(): Promise<Array<{ id: string; name: string; ssh_key: string }>> {
        const result = await this.request<{ ssh_keys: Array<{ id: string; name: string; ssh_key: string }> }>('/ssh-keys');
        return result.ssh_keys;
    }

    async createSSHKey(name: string, sshKey: string): Promise<{ id: string; name: string }> {
        const result = await this.request<{ ssh_key: { id: string; name: string } }>('/ssh-keys', {
            method: 'POST',
            body: JSON.stringify({ name, ssh_key: sshKey })
        });
        return result.ssh_key;
    }
}

export const vultr = new VultrClient();
