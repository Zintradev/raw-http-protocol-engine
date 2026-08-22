const { buildResponse, buildJSONResponse, build404NotFound, build400BadRequest, build405MethodNotAllowed } = require('./http_response');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.json': 'application/json',
    '.ico': 'image/x-icon'
};

const routes = {
    'GET': {},
    'POST': {},
    'PUT': {},
    'DELETE': {}
};

let globalApiKey = null;

function registerRoute(method, path, handler) {
    if (!routes[method]) routes[method] = {};
    routes[method][path] = handler;
}

function setApiKey(key) {
    globalApiKey = key;
}

function matchRoute(method, path) {
    if (!routes[method]) return null;

    if (routes[method][path]) {
        return { handler: routes[method][path], params: {} };
    }

    const requestSegments = path.split('/').filter(Boolean);

    for (const routePath of Object.keys(routes[method])) {
        const routeSegments = routePath.split('/').filter(Boolean);
        if (routeSegments.length !== requestSegments.length) continue;

        const params = {};
        let matched = true;

        for (let i = 0; i < routeSegments.length; i++) {
            const routeSegment = routeSegments[i];
            const requestSegment = requestSegments[i];

            if (routeSegment.startsWith(':')) {
                const paramName = routeSegment.slice(1);
                params[paramName] = requestSegment;
            } else if (routeSegment !== requestSegment) {
                matched = false;
                break;
            }
        }

        if (matched) {
            return { handler: routes[method][routePath], params };
        }
    }

    return null;
}

async function handleRequest(req) {
    const { method, path: reqPath } = req;

    console.log(`[Router] ${method} ${reqPath}`);

    if (req.bodyError) {
        return build400BadRequest(req.bodyError);
    }

    if (globalApiKey) {
        if (req.headers['x-api-key'] !== globalApiKey) {
            console.log(`[Router] Blocked: missing or invalid API key.`);
            return buildJSONResponse(401, 'Unauthorized', { error: 'Acceso denegado. API Key inválida o inexistente en cabecera x-api-key.' });
        }
    }

    const match = matchRoute(method, reqPath);
    if (match) {
        req.params = match.params;
        return await match.handler(req);
    }

    let routeExistsForOtherMethod = false;
    for (const registeredMethod of Object.keys(routes)) {
        if (registeredMethod !== method && matchRoute(registeredMethod, reqPath)) {
            routeExistsForOtherMethod = true;
            break;
        }
    }

    if (routeExistsForOtherMethod) {
        return build405MethodNotAllowed(`El método ${method} no está permitido en esta ruta`);
    }

    if (method === 'GET') {
        const publicDir = path.resolve(__dirname, '..', 'public');
        const safePath = reqPath === '/web' ? '/index.html' : reqPath;
        const filePath = path.join(publicDir, safePath);

        if (!filePath.startsWith(publicDir)) {
            return build404NotFound('Acceso denegado a rutas seguras del sistema');
        }

        try {
            const stat = await fs.promises.stat(filePath);
            if (stat.isFile()) {
                const extname = path.extname(filePath).toLowerCase();
                const contentType = mimeTypes[extname] || 'application/octet-stream';
                
                const fileContents = await fs.promises.readFile(filePath);
                
                return buildResponse({
                    statusCode: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': contentType },
                    body: fileContents
                });
            }
        } catch (error) {
            // File not found, fall through to 404
        }
    }

    return build404NotFound('Ruta no encontrada en el servidor');
}

// ==========================================
// Initial demo routes
// ==========================================

registerRoute('GET', '/', (req) => {
    return buildJSONResponse(200, 'OK', { message: "¡Hola Mundo desde el Servidor TCP crudo!" });
});

registerRoute('GET', '/status', (req) => {
    return buildResponse({
        statusCode: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/plain' },
        body: "Servidor operativo."
    });
});

registerRoute('GET', '/test-cookie', (req) => {
    const hasVisited = req.cookies && req.cookies['visited'];
    
    let message = "Bienvenido por primera vez. Te hemos asignado una cookie.";
    if (hasVisited) {
        message = "¡Qué bueno verte de nuevo! He leído tu cookie.";
    }

    return buildResponse({
        statusCode: 200,
        statusText: 'OK',
        headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': ['visited=true; Path=/; Max-Age=3600']
        },
        body: JSON.stringify({ message, cookiesRecibidas: req.cookies })
    });
});

// ==========================================
// In-memory data store (Dogs CRUD)
// ==========================================
let dogs = [
    { id: 1, name: "Hercules", breed: "Mastín", age: 3 },
    { id: 2, name: "Luna", breed: "Labrador", age: 1 }
];
let nextDogId = 3;

registerRoute('GET', '/dogs', (req) => {
    return buildJSONResponse(200, 'OK', dogs);
});

registerRoute('GET', '/dogs/:id', (req) => {
    const id = parseInt(req.params.id, 10);
    const dog = dogs.find((item) => item.id === id);

    if (!dog) {
        return build404NotFound('Perro no encontrado');
    }

    return buildJSONResponse(200, 'OK', dog);
});

registerRoute('PUT', '/dogs/:id', (req) => {
    const id = parseInt(req.params.id, 10);
    const dogIndex = dogs.findIndex((item) => item.id === id);

    if (dogIndex === -1) {
        return build404NotFound('Perro no encontrado');
    }

    if (typeof req.body !== 'object' || req.body === null) {
        return build400BadRequest('Se esperaba un objeto JSON válido en el body');
    }
    const updatedData = req.body;

    const existingDog = dogs[dogIndex];
    const updatedDog = Object.assign({}, existingDog, updatedData, { id: existingDog.id });
    dogs[dogIndex] = updatedDog;

    return buildJSONResponse(200, 'OK', updatedDog);
});

registerRoute('DELETE', '/dogs/:id', (req) => {
    const id = parseInt(req.params.id, 10);
    const dogIndex = dogs.findIndex((item) => item.id === id);

    if (dogIndex === -1) {
        return build404NotFound('Perro no encontrado');
    }

    dogs.splice(dogIndex, 1);

    return buildResponse({
        statusCode: 204,
        statusText: 'No Content',
        headers: {},
        body: ''
    });
});

registerRoute('POST', '/dogs', (req) => {
    if (typeof req.body !== 'object' || req.body === null) {
        return build400BadRequest('Se esperaba un objeto JSON válido en el body');
    }
    const newDog = req.body;

    newDog.id = nextDogId++;
    dogs.push(newDog);

    return buildJSONResponse(201, 'Created', newDog);
});

module.exports = { registerRoute, handleRequest, setApiKey };