/**
 * Service for handling Google Service Account Authentication
 * Generates JWTs and exchanges them for Access Tokens
 */
class TokenService {
    constructor(credentials) {
        this.email = credentials.client_email;
        this.privateKeyPem = credentials.private_key;
        this.tokenUrl = 'https://oauth2.googleapis.com/token';
        this.scope = 'https://www.googleapis.com/auth/cloud-platform';

        this.cachedToken = null;
        this.tokenExpiration = 0;
    }

    /**
     * Get a valid access token
     */
    async getAccessToken() {
        // Check if cached token is valid (with 5 minute buffer)
        if (this.cachedToken && Date.now() < this.tokenExpiration - 300000) {
            return this.cachedToken;
        }

        console.log('TokenService: Generating new access token...');
        const jwt = await this.createSignedJWT();
        const token = await this.exchangeJwtForAccessToken(jwt);

        this.cachedToken = token.access_token;
        this.tokenExpiration = Date.now() + (token.expires_in * 1000);

        return this.cachedToken;
    }

    /**
     * Create a signed JWT using Web Crypto API
     */
    async createSignedJWT() {
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const claimSet = {
            iss: this.email,
            scope: this.scope,
            aud: this.tokenUrl,
            exp: now + 3600,
            iat: now
        };

        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedClaimSet = this.base64UrlEncode(JSON.stringify(claimSet));
        const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

        const signature = await this.sign(unsignedToken);
        return `${unsignedToken}.${signature}`;
    }

    /**
     * Sign the data using the private key
     */
    async sign(data) {
        const privateKey = await this.importPrivateKey(this.privateKeyPem);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        const signatureBuffer = await crypto.subtle.sign(
            {
                name: 'RSASSA-PKCS1-v1_5',
            },
            privateKey,
            dataBuffer
        );

        return this.base64UrlEncode(new Uint8Array(signatureBuffer));
    }

    /**
     * Import PEM private key
     */
    async importPrivateKey(pem) {
        // Remove headers and newlines
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const pemContents = pem.substring(
            pem.indexOf(pemHeader) + pemHeader.length,
            pem.indexOf(pemFooter)
        ).replace(/\s/g, '');

        // Base64 decode
        const binaryString = atob(pemContents);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return await crypto.subtle.importKey(
            'pkcs8',
            bytes.buffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' },
            },
            false,
            ['sign']
        );
    }

    /**
     * Exchange signed JWT for Access Token
     */
    async exchangeJwtForAccessToken(jwt) {
        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Token exchange failed (${response.status}): ${text}`);
        }

        return await response.json();
    }

    /**
     * Helper: Base64URL Encode
     */
    base64UrlEncode(input) {
        let buffer;
        if (typeof input === 'string') {
            const encoder = new TextEncoder();
            buffer = encoder.encode(input);
        } else {
            buffer = input;
        }

        let base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}

// Export for use in modules or global scope
if (typeof window !== 'undefined') {
    window.TokenService = TokenService;
}
