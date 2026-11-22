<?php
/**
 * ReadmeWeb - Server Documents Backend API for PHP / Apache / Hostinger
 * 
 * Provides endpoints for managing server folders, scanning markdown documents,
 * reading and saving documents directly on the server hosting ReadmeWeb.
 */

// Headers for JSON API and CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$webRoot = str_replace('\\', '/', dirname(__DIR__));

// Locate config file: prefer root readmeweb.config.json, fallback to api/readmeweb.config.json
function getConfigFile($root) {
    $rootConfig = $root . '/readmeweb.config.json';
    $localConfig = __DIR__ . '/readmeweb.config.json';
    if (file_exists($rootConfig)) return $rootConfig;
    if (file_exists($localConfig)) return $localConfig;
    if (@is_writable($root)) {
        return $rootConfig;
    }
    return $localConfig;
}

$configFile = getConfigFile($webRoot);

function deduplicateFolders($folders, $webRoot = '') {
    $seen = [];
    $unique = [];
    foreach ($folders as $f) {
        $p = str_replace('\\', '/', $f['path'] ?? '');
        $real = realpath($p);
        if ($real === false && !empty($webRoot)) {
            $candidate = $webRoot . '/' . ltrim($p, '/\\');
            $real = realpath($candidate);
        }
        $key = $real !== false ? strtolower(str_replace('\\', '/', $real)) : strtolower(rtrim($p, '/\\'));
        if (!empty($key)) {
            $isDuplicateOrSub = isset($seen[$key]);
            if (!$isDuplicateOrSub) {
                foreach (array_keys($seen) as $existingKey) {
                    if (str_starts_with($key, $existingKey . '/')) {
                        $isDuplicateOrSub = true;
                        break;
                    }
                }
            }
            if (!$isDuplicateOrSub) {
                $seen[$key] = true;
                $unique[] = $f;
            }
        }
    }
    return $unique;
}

function loadConfig($file, $webRoot = '') {
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $data = json_decode($raw, true);
            if (is_array($data) && isset($data['serverFolders']) && is_array($data['serverFolders']) && count($data['serverFolders']) > 0) {
                $data['serverFolders'] = deduplicateFolders($data['serverFolders'], $webRoot);
                return $data;
            }
        }
    }
    return [
        'serverFolders' => [
            [
                'id' => 'folder-docs',
                'name' => 'All docs of server',
                'path' => 'docs'
            ]
        ]
    ];
}

function saveConfig(&$file, $config) {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $res = @file_put_contents($file, $json, LOCK_EX);
    if ($res === false) {
        $local = __DIR__ . '/readmeweb.config.json';
        if ($file !== $local) {
            $file = $local;
            $res = @file_put_contents($file, $json, LOCK_EX);
        }
    }
    return $res !== false;
}

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Determine route
$route = '';
if (isset($_GET['route']) && !empty($_GET['route'])) {
    $route = trim($_GET['route'], '/');
} else {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = preg_replace('#^.*?/api(?:/index\.php)?/?#', '', $uri);
    $route = trim($uri, '/');
}

$method = $_SERVER['REQUEST_METHOD'];

// Ignored directories during recursive scan
$ignoredDirs = [
    'node_modules' => true,
    '.git' => true,
    'dist' => true,
    '.tmp' => true,
    'out' => true,
    'release' => true,
    '.system_generated' => true
];

function scanMarkdownFiles($dir, $baseDir, $rootId, $rootName, &$results, $ignoredDirs, $maxDepth = 15, $currentDepth = 0) {
    if ($currentDepth > $maxDepth || !is_dir($dir) || !is_readable($dir)) return;

    $items = @scandir($dir);
    if ($items === false) return;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || str_starts_with($item, '.')) continue;

        $fullPath = $dir . '/' . $item;

        if (is_dir($fullPath)) {
            if (isset($ignoredDirs[$item])) continue;
            scanMarkdownFiles($fullPath, $baseDir, $rootId, $rootName, $results, $ignoredDirs, $maxDepth, $currentDepth + 1);
        } elseif (is_file($fullPath)) {
            $lower = strtolower($item);
            if (str_ends_with($lower, '.md') || str_ends_with($lower, '.markdown') || str_ends_with($lower, '.mdown') || str_ends_with($lower, '.mkd') || str_ends_with($lower, '.mdx')) {
                $stat = @stat($fullPath);
                $rel = ltrim(str_replace('\\', '/', substr($fullPath, strlen($baseDir))), '/');
                $results[] = [
                    'rootId' => $rootId,
                    'rootName' => $rootName,
                    'relativePath' => $rel,
                    'name' => $item,
                    'sizeBytes' => $stat ? $stat['size'] : @filesize($fullPath),
                    'lastModified' => $stat ? $stat['mtime'] * 1000 : @filemtime($fullPath) * 1000
                ];
            }
        }
    }
}

// -------------------------------------------------------------------------
// Route Handlers
// -------------------------------------------------------------------------

// 1. GET /api/server-folders
if ($route === 'server-folders' && $method === 'GET') {
    $config = loadConfig($configFile, $webRoot);
    jsonResponse([
        'ok' => true,
        'folders' => $config['serverFolders'],
        'serverRoot' => $webRoot
    ]);
}

// 2. POST /api/server-folders (Add root folder)
if ($route === 'server-folders' && $method === 'POST') {
    $body = getJsonBody();
    $name = trim($body['name'] ?? '');
    $folderPath = trim($body['path'] ?? '');

    if (empty($name) || empty($folderPath)) {
        jsonResponse(['ok' => false, 'error' => 'Folder label and path are required'], 400);
    }

    $folderPathTrimmed = rtrim($folderPath, '/\\');

    // Try resolving as absolute path first
    $real = realpath($folderPathTrimmed);

    // If not found, try creating it directly
    if ($real === false && !is_dir($folderPathTrimmed)) {
        @mkdir($folderPathTrimmed, 0755, true);
        $real = realpath($folderPathTrimmed);
    }

    // If still not found, try resolving relative to web root (public_html)
    if ($real === false) {
        $candidate = $webRoot . '/' . ltrim($folderPathTrimmed, '/\\');
        if (!is_dir($candidate)) {
            @mkdir($candidate, 0755, true);
        }
        $real = realpath($candidate);
    }

    if ($real === false || !is_dir($real)) {
        $lastErr = error_get_last();
        $detail = $lastErr ? ' (' . $lastErr['message'] . ')' : '';
        jsonResponse([
            'ok' => false,
            'error' => "Directory does not exist or cannot be created on server: $folderPath$detail",
            'serverRoot' => $webRoot
        ], 400);
    }

    $folderPath = str_replace('\\', '/', $real);
    $config = loadConfig($configFile, $webRoot);

    // Prevent duplicate folder label or duplicate resolved path
    $canonicalNew = strtolower(str_replace('\\', '/', $real));
    foreach ($config['serverFolders'] as $existing) {
        if (strcasecmp($existing['name'], $name) === 0) {
            jsonResponse(['ok' => false, 'error' => "A folder with label \"$name\" already exists."], 400);
        }
        $existingReal = realpath($existing['path']);
        if ($existingReal === false) {
            $existingCandidate = $webRoot . '/' . ltrim(str_replace('\\', '/', $existing['path']), '/\\');
            $existingReal = realpath($existingCandidate);
        }
        if ($existingReal !== false) {
            $canonicalExisting = strtolower(str_replace('\\', '/', $existingReal));
            if ($canonicalExisting === $canonicalNew) {
                jsonResponse(['ok' => false, 'error' => "This folder path is already configured as \"{$existing['name']}\"."], 400);
            }
            if (str_starts_with($canonicalNew, $canonicalExisting . '/')) {
                jsonResponse(['ok' => false, 'error' => "This folder is a subfolder of \"{$existing['name']}\", which is already configured."], 400);
            }
            if (str_starts_with($canonicalExisting, $canonicalNew . '/')) {
                jsonResponse(['ok' => false, 'error' => "This folder contains \"{$existing['name']}\", which is already configured as a root folder."], 400);
            }
        }
    }

    $id = 'folder-' . time() . '-' . mt_rand(100, 999);
    $newFolder = ['id' => $id, 'name' => $name, 'path' => $folderPath];
    $config['serverFolders'][] = $newFolder;

    if (!saveConfig($configFile, $config)) {
        jsonResponse(['ok' => false, 'error' => 'Failed to save configuration file on server. Check write permissions.'], 500);
    }

    jsonResponse([
        'ok' => true,
        'folder' => $newFolder,
        'folders' => $config['serverFolders'],
        'serverRoot' => $webRoot
    ]);
}

// 3. DELETE /api/server-folders (Remove root folder)
if ($route === 'server-folders' && $method === 'DELETE') {
    $body = getJsonBody();
    $id = trim($body['id'] ?? ($_GET['id'] ?? ''));

    if (empty($id)) {
        jsonResponse(['ok' => false, 'error' => 'Folder id is required'], 400);
    }

    $config = loadConfig($configFile, $webRoot);
    $filtered = [];
    foreach ($config['serverFolders'] as $f) {
        if ($f['id'] !== $id) {
            $filtered[] = $f;
        }
    }
    $config['serverFolders'] = $filtered;
    saveConfig($configFile, $config);

    jsonResponse(['ok' => true, 'folders' => $config['serverFolders'], 'serverRoot' => $webRoot]);
}

// 4. GET /api/server-documents
if ($route === 'server-documents' && $method === 'GET') {
    $config = loadConfig($configFile, $webRoot);
    $rootId = trim($_GET['rootId'] ?? '');

    $foldersToScan = [];
    foreach ($config['serverFolders'] as $f) {
        if (empty($rootId) || $f['id'] === $rootId) {
            $foldersToScan[] = $f;
        }
    }

    $documents = [];
    foreach ($foldersToScan as $f) {
        $p = str_replace('\\', '/', $f['path']);
        if (!is_dir($p)) {
            $candidate = $webRoot . '/' . ltrim($p, '/\\');
            if (is_dir($candidate)) {
                $p = $candidate;
            }
        }
        if (is_dir($p)) {
            scanMarkdownFiles($p, $p, $f['id'], $f['name'], $documents, $ignoredDirs);
        }
    }

    jsonResponse([
        'ok' => true,
        'documents' => $documents,
        'folders' => $config['serverFolders'],
        'serverRoot' => $webRoot
    ]);
}

// 5. GET /api/read-server-document
if ($route === 'read-server-document' && $method === 'GET') {
    $rootId = trim($_GET['rootId'] ?? '');
    $relPath = trim($_GET['path'] ?? '');

    if (empty($rootId) || empty($relPath)) {
        jsonResponse(['ok' => false, 'error' => 'rootId and path are required'], 400);
    }

    $config = loadConfig($configFile, $webRoot);
    $folder = null;
    foreach ($config['serverFolders'] as $f) {
        if ($f['id'] === $rootId) {
            $folder = $f;
            break;
        }
    }

    if (!$folder) {
        jsonResponse(['ok' => false, 'error' => 'Configured root folder not found on server'], 404);
    }

    $base = realpath($folder['path']);
    if ($base === false) {
        $candidate = $webRoot . '/' . ltrim($folder['path'], '/\\');
        $base = realpath($candidate);
    }
    if ($base === false) {
        jsonResponse(['ok' => false, 'error' => 'Root folder path is invalid or missing on server'], 404);
    }
    $base = str_replace('\\', '/', $base);

    $target = realpath($base . '/' . $relPath);
    if ($target === false || !is_file($target)) {
        jsonResponse(['ok' => false, 'error' => 'Document not found on server'], 404);
    }
    $target = str_replace('\\', '/', $target);

    // Path traversal security check
    if (!str_starts_with($target, $base . '/') && $target !== $base) {
        jsonResponse(['ok' => false, 'error' => 'Access denied: Path escapes root directory'], 403);
    }

    $content = file_get_contents($target);
    if ($content === false) {
        jsonResponse(['ok' => false, 'error' => 'Could not read document contents'], 500);
    }

    $fileName = basename($target);
    $stat = @stat($target);

    jsonResponse([
        'ok' => true,
        'content' => $content,
        'name' => $fileName,
        'path' => $relPath,
        'rootId' => $rootId,
        'rootName' => $folder['name'],
        'sizeBytes' => $stat ? $stat['size'] : strlen($content),
        'lastModified' => $stat ? $stat['mtime'] * 1000 : time() * 1000
    ]);
}

// 6. POST /api/save-server-document
if ($route === 'save-server-document' && $method === 'POST') {
    $body = getJsonBody();
    $rootId = trim($body['rootId'] ?? '');
    $relPath = trim($body['path'] ?? '');
    $content = $body['content'] ?? null;

    if (empty($rootId) || empty($relPath) || !is_string($content)) {
        jsonResponse(['ok' => false, 'error' => 'rootId, path, and content are required'], 400);
    }

    $config = loadConfig($configFile, $webRoot);
    $folder = null;
    foreach ($config['serverFolders'] as $f) {
        if ($f['id'] === $rootId) {
            $folder = $f;
            break;
        }
    }

    if (!$folder) {
        jsonResponse(['ok' => false, 'error' => 'Configured root folder not found on server'], 404);
    }

    $base = realpath($folder['path']);
    if ($base === false) {
        $candidate = $webRoot . '/' . ltrim($folder['path'], '/\\');
        $base = realpath($candidate);
    }
    if ($base === false) {
        jsonResponse(['ok' => false, 'error' => 'Root folder path is invalid or missing on server'], 404);
    }
    $base = str_replace('\\', '/', $base);

    $targetFullPath = $base . '/' . ltrim(str_replace('\\', '/', $relPath), '/');

    // Path traversal check on directory
    $targetDir = realpath(dirname($targetFullPath));
    if ($targetDir === false) {
        @mkdir(dirname($targetFullPath), 0755, true);
        $targetDir = realpath(dirname($targetFullPath));
    }

    if ($targetDir === false || (!str_starts_with(str_replace('\\', '/', $targetDir), $base) && $targetDir !== $base)) {
        jsonResponse(['ok' => false, 'error' => 'Access denied: Path escapes root directory'], 403);
    }

    if (@file_put_contents($targetFullPath, $content, LOCK_EX) === false) {
        jsonResponse(['ok' => false, 'error' => 'Failed to write file to disk. Check server write permissions.'], 500);
    }

    $stat = @stat($targetFullPath);
    jsonResponse([
        'ok' => true,
        'sizeBytes' => $stat ? $stat['size'] : strlen($content),
        'lastModified' => $stat ? $stat['mtime'] * 1000 : time() * 1000
    ]);
}

// Route not found
jsonResponse([
    'ok' => false,
    'error' => "API route not found: $route ($method)",
    'availableEndpoints' => [
        'GET /api/server-folders',
        'POST /api/server-folders',
        'DELETE /api/server-folders',
        'GET /api/server-documents',
        'GET /api/read-server-document',
        'POST /api/save-server-document'
    ]
], 404);
