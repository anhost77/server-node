// VPS Providers - unified interface
import { hetzner, HetznerClient } from './hetzner.js';
import { digitalocean, DigitalOceanClient } from './digitalocean.js';
import { vultr, VultrClient } from './vultr.js';

export type Provider = 'hetzner' | 'digitalocean' | 'vultr';

export interface ServerPlan {
    id: string;
    provider: Provider;
    name: string;
    vcpus: number;
    memory: number;      // MB
    disk: number;        // GB
    priceMonthly: number; // cents
    priceHourly: number;  // cents
    regions: string[];
}

export interface ServerRegion {
    id: string;
    provider: Provider;
    name: string;
    country: string;
    city?: string;
}

export interface ProvisionedServer {
    id: string;
    provider: Provider;
    providerId: string;
    name: string;
    status: string;
    ipv4?: string;
    ipv6?: string;
    plan: string;
    region: string;
    createdAt: string;
}

export interface ProviderStatus {
    provider: Provider;
    configured: boolean;
    name: string;
}

// Get status of all providers
export function getProviderStatuses(): ProviderStatus[] {
    return [
        { provider: 'hetzner', configured: hetzner.isConfigured(), name: 'Hetzner Cloud' },
        { provider: 'digitalocean', configured: digitalocean.isConfigured(), name: 'DigitalOcean' },
        { provider: 'vultr', configured: vultr.isConfigured(), name: 'Vultr' }
    ];
}

// Get available server plans from all configured providers
export async function getAllPlans(): Promise<ServerPlan[]> {
    const plans: ServerPlan[] = [];

    if (hetzner.isConfigured()) {
        try {
            const hetznerTypes = await hetzner.getServerTypes();
            for (const t of hetznerTypes) {
                const price = t.prices.find(p => p.location === 'fsn1') || t.prices[0];
                if (price) {
                    plans.push({
                        id: `hetzner-${t.name}`,
                        provider: 'hetzner',
                        name: `${t.name} - ${t.description}`,
                        vcpus: t.cores,
                        memory: t.memory * 1024,
                        disk: t.disk,
                        priceMonthly: Math.round(parseFloat(price.price_monthly.gross) * 100),
                        priceHourly: Math.round(parseFloat(price.price_hourly.gross) * 100),
                        regions: t.prices.map(p => p.location)
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch Hetzner plans:', e);
        }
    }

    if (digitalocean.isConfigured()) {
        try {
            const doSizes = await digitalocean.getSizes();
            for (const s of doSizes) {
                plans.push({
                    id: `digitalocean-${s.slug}`,
                    provider: 'digitalocean',
                    name: `${s.slug} - ${s.description}`,
                    vcpus: s.vcpus,
                    memory: s.memory,
                    disk: s.disk,
                    priceMonthly: Math.round(s.price_monthly * 100),
                    priceHourly: Math.round(s.price_hourly * 100),
                    regions: s.regions
                });
            }
        } catch (e) {
            console.error('Failed to fetch DigitalOcean plans:', e);
        }
    }

    if (vultr.isConfigured()) {
        try {
            const vultrPlans = await vultr.getPlans();
            for (const p of vultrPlans) {
                plans.push({
                    id: `vultr-${p.id}`,
                    provider: 'vultr',
                    name: `${p.id} - ${p.vcpu_count} vCPU, ${p.ram}MB RAM`,
                    vcpus: p.vcpu_count,
                    memory: p.ram,
                    disk: p.disk,
                    priceMonthly: Math.round(p.monthly_cost * 100),
                    priceHourly: Math.round((p.monthly_cost / 720) * 100),
                    regions: p.locations
                });
            }
        } catch (e) {
            console.error('Failed to fetch Vultr plans:', e);
        }
    }

    return plans.sort((a, b) => a.priceMonthly - b.priceMonthly);
}

// Get all regions from configured providers
export async function getAllRegions(): Promise<ServerRegion[]> {
    const regions: ServerRegion[] = [];

    if (hetzner.isConfigured()) {
        try {
            const hetznerLocations = await hetzner.getLocations();
            for (const l of hetznerLocations) {
                regions.push({
                    id: `hetzner-${l.name}`,
                    provider: 'hetzner',
                    name: l.description,
                    country: l.country,
                    city: l.city
                });
            }
        } catch (e) {
            console.error('Failed to fetch Hetzner regions:', e);
        }
    }

    if (digitalocean.isConfigured()) {
        try {
            const doRegions = await digitalocean.getRegions();
            for (const r of doRegions) {
                regions.push({
                    id: `digitalocean-${r.slug}`,
                    provider: 'digitalocean',
                    name: r.name,
                    country: r.slug.split(/[0-9]/)[0].toUpperCase()
                });
            }
        } catch (e) {
            console.error('Failed to fetch DigitalOcean regions:', e);
        }
    }

    if (vultr.isConfigured()) {
        try {
            const vultrRegions = await vultr.getRegions();
            for (const r of vultrRegions) {
                regions.push({
                    id: `vultr-${r.id}`,
                    provider: 'vultr',
                    name: `${r.city}, ${r.country}`,
                    country: r.country,
                    city: r.city
                });
            }
        } catch (e) {
            console.error('Failed to fetch Vultr regions:', e);
        }
    }

    return regions;
}

// Generate cloud-init script for automatic ServerFlow agent installation
function generateCloudInit(agentToken: string, controlPlaneUrl: string): string {
    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install ServerFlow agent
mkdir -p /opt/serverflow
cd /opt/serverflow

# Download and install the agent
npm install -g serverflow-agent || true

# Create config
cat > /opt/serverflow/config.json << EOF
{
    "controlPlaneUrl": "${controlPlaneUrl}",
    "agentToken": "${agentToken}"
}
EOF

# Create systemd service
cat > /etc/systemd/system/serverflow-agent.service << EOF
[Unit]
Description=ServerFlow Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/npx serverflow-agent --config /opt/serverflow/config.json
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable serverflow-agent
systemctl start serverflow-agent
`;
}

// Provision a new server
export async function provisionServer(
    provider: Provider,
    planId: string,
    regionId: string,
    name: string,
    agentToken: string,
    controlPlaneUrl: string
): Promise<ProvisionedServer> {
    const userData = generateCloudInit(agentToken, controlPlaneUrl);

    switch (provider) {
        case 'hetzner': {
            const result = await hetzner.createServer({
                name,
                serverType: planId,
                location: regionId,
                userData
            });
            return {
                id: `hetzner-${result.server.id}`,
                provider: 'hetzner',
                providerId: String(result.server.id),
                name: result.server.name,
                status: result.server.status,
                ipv4: result.server.public_net.ipv4?.ip,
                ipv6: result.server.public_net.ipv6?.ip,
                plan: result.server.server_type.name,
                region: result.server.datacenter.location.name,
                createdAt: result.server.created
            };
        }

        case 'digitalocean': {
            const droplet = await digitalocean.createDroplet({
                name,
                size: planId,
                region: regionId,
                userData
            });
            const publicIpv4 = droplet.networks.v4.find(n => n.type === 'public');
            const publicIpv6 = droplet.networks.v6.find(n => n.type === 'public');
            return {
                id: `digitalocean-${droplet.id}`,
                provider: 'digitalocean',
                providerId: String(droplet.id),
                name: droplet.name,
                status: droplet.status,
                ipv4: publicIpv4?.ip_address,
                ipv6: publicIpv6?.ip_address,
                plan: droplet.size.slug,
                region: droplet.region.slug,
                createdAt: droplet.created_at
            };
        }

        case 'vultr': {
            const instance = await vultr.createInstance({
                label: name,
                plan: planId,
                region: regionId,
                userData
            });
            return {
                id: `vultr-${instance.id}`,
                provider: 'vultr',
                providerId: instance.id,
                name: instance.label,
                status: instance.status,
                ipv4: instance.main_ip,
                ipv6: instance.v6_main_ip,
                plan: instance.plan,
                region: instance.region,
                createdAt: instance.date_created
            };
        }
    }
}

// Delete a provisioned server
export async function deleteProvisionedServer(provider: Provider, providerId: string): Promise<void> {
    switch (provider) {
        case 'hetzner':
            await hetzner.deleteServer(parseInt(providerId));
            break;
        case 'digitalocean':
            await digitalocean.deleteDroplet(parseInt(providerId));
            break;
        case 'vultr':
            await vultr.deleteInstance(providerId);
            break;
    }
}

// Get server status from provider
export async function getServerStatus(provider: Provider, providerId: string): Promise<ProvisionedServer | null> {
    try {
        switch (provider) {
            case 'hetzner': {
                const server = await hetzner.getServer(parseInt(providerId));
                return {
                    id: `hetzner-${server.id}`,
                    provider: 'hetzner',
                    providerId: String(server.id),
                    name: server.name,
                    status: server.status,
                    ipv4: server.public_net.ipv4?.ip,
                    ipv6: server.public_net.ipv6?.ip,
                    plan: server.server_type.name,
                    region: server.datacenter.location.name,
                    createdAt: server.created
                };
            }

            case 'digitalocean': {
                const droplet = await digitalocean.getDroplet(parseInt(providerId));
                const publicIpv4 = droplet.networks.v4.find(n => n.type === 'public');
                const publicIpv6 = droplet.networks.v6.find(n => n.type === 'public');
                return {
                    id: `digitalocean-${droplet.id}`,
                    provider: 'digitalocean',
                    providerId: String(droplet.id),
                    name: droplet.name,
                    status: droplet.status,
                    ipv4: publicIpv4?.ip_address,
                    ipv6: publicIpv6?.ip_address,
                    plan: droplet.size.slug,
                    region: droplet.region.slug,
                    createdAt: droplet.created_at
                };
            }

            case 'vultr': {
                const instance = await vultr.getInstance(providerId);
                return {
                    id: `vultr-${instance.id}`,
                    provider: 'vultr',
                    providerId: instance.id,
                    name: instance.label,
                    status: instance.status,
                    ipv4: instance.main_ip,
                    ipv6: instance.v6_main_ip,
                    plan: instance.plan,
                    region: instance.region,
                    createdAt: instance.date_created
                };
            }
        }
    } catch (e) {
        console.error(`Failed to get server status for ${provider}/${providerId}:`, e);
        return null;
    }
}

export { hetzner, digitalocean, vultr };
