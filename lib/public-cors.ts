const defaultOrigins = [
    'http://127.0.0.1:4322',
    'http://localhost:4322',
    'https://rotaract.mg',
    'https://www.rotaract.mg',
    'https://tolotagnana.rotaract.mg',
];

const configuredOrigins = (process.env.VOLUNTEER_FORM_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

export function publicCorsHeaders(request: Request): HeadersInit {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { Vary: 'Origin' };

    if (origin && allowedOrigins.has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
