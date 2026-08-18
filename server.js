const express = require('express');
const cors = require('cors');
const dns = require('dns').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function resolveDomain(domain) {
    const ips = [];

    const [ipv4Results, ipv6Results] = await Promise.allSettled([
        dns.resolve4(domain),
        dns.resolve6(domain)
    ]);

    if (ipv4Results.status === 'fulfilled' && Array.isArray(ipv4Results.value)) {
        ips.push(...ipv4Results.value);
    }

    if (ipv6Results.status === 'fulfilled' && Array.isArray(ipv6Results.value)) {
        ips.push(...ipv6Results.value);
    }

    return [...new Set(ips)];
}

app.get('/resolve', async (req, res) => {
    const domain = req.query.domain;

    if (!domain) {
        return res.status(400).json({
            error: true,
            message: 'Domain query parameter is required'
        });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].trim();

    try {
        const ips = await resolveDomain(cleanDomain);

        if (ips.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'No IP addresses found for the specified domain',
                domain: cleanDomain,
                total_ips: 0,
                total_groups: 0,
                groups: []
            });
        }

        ips.sort((a, b) => a.length - b.length || a.localeCompare(b));

        const groupSize = 40;
        const groups = [];
        for (let i = 0; i < ips.length; i += groupSize) {
            groups.push(ips.slice(i, i + groupSize));
        }

        return res.status(200).json({
            success: true,
            domain: cleanDomain,
            total_ips: ips.length,
            total_groups: groups.length,
            groups: groups
        });

    } catch (err) {
        return res.status(500).json({
            error: true,
            message: 'Failed to resolve domain',
            details: err.message
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`DNS Resolver service is running on port ${PORT}`);
});
