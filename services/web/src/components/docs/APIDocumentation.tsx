/**
 * API Documentation Component
 * Task 199: API documentation portal
 */

import { useState } from 'react';
import { Book, Code, Copy, Check, ChevronRight, ExternalLink } from 'lucide-react';

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    location: 'path' | 'query' | 'body';
  }[];
  requestBody?: {
    type: string;
    example: string;
  };
  response?: {
    status: number;
    type: string;
    example: string;
  };
  authentication: boolean;
}

interface APISection {
  name: string;
  description: string;
  endpoints: APIEndpoint[];
}

const API_SECTIONS: APISection[] = [
  {
    name: 'Research',
    description: 'Endpoints for managing research projects',
    endpoints: [
      {
        method: 'GET',
        path: '/api/research',
        description: 'List all research projects',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: 'Max results', location: 'query' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status', location: 'query' },
        ],
        response: {
          status: 200,
          type: 'array',
          example: '[\n  {\n    "id": "res_123",\n    "title": "Research Title",\n    "status": "completed"\n  }\n]',
        },
        authentication: true,
      },
      {
        method: 'POST',
        path: '/api/research',
        description: 'Create a new research project',
        requestBody: {
          type: 'object',
          example: '{\n  "title": "New Research",\n  "description": "Research description",\n  "sources": ["source1", "source2"]\n}',
        },
        response: {
          status: 201,
          type: 'object',
          example: '{\n  "id": "res_456",\n  "title": "New Research",\n  "status": "pending"\n}',
        },
        authentication: true,
      },
      {
        method: 'GET',
        path: '/api/research/:id',
        description: 'Get research project details',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Research ID', location: 'path' },
        ],
        authentication: true,
      },
    ],
  },
  {
    name: 'Jobs',
    description: 'Endpoints for job management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/jobs',
        description: 'List all jobs',
        authentication: true,
      },
      {
        method: 'POST',
        path: '/api/jobs',
        description: 'Submit a new job',
        requestBody: {
          type: 'object',
          example: '{\n  "type": "research",\n  "researchId": "res_123",\n  "config": {}\n}',
        },
        authentication: true,
      },
      {
        method: 'POST',
        path: '/api/jobs/:id/cancel',
        description: 'Cancel a running job',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Job ID', location: 'path' },
        ],
        authentication: true,
      },
    ],
  },
  {
    name: 'Artifacts',
    description: 'Endpoints for artifact management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/artifacts',
        description: 'List artifacts',
        authentication: true,
      },
      {
        method: 'GET',
        path: '/api/artifacts/:id/download',
        description: 'Download an artifact',
        authentication: true,
      },
    ],
  },
];

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-400 text-xs">
        <span>{language}</span>
        <button onClick={handleCopy} className="hover:text-white">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 text-sm text-slate-100 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: APIEndpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
      >
        <span className={`px-2 py-1 rounded text-xs font-mono font-semibold ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <code className="font-mono text-sm flex-1">{endpoint.path}</code>
        <span className="text-muted-foreground text-sm hidden md:block">
          {endpoint.description}
        </span>
        <ChevronRight
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="p-4 border-t bg-muted/30 space-y-4">
          <p className="text-muted-foreground">{endpoint.description}</p>

          {endpoint.authentication && (
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                🔐 Authentication required
              </span>
            </div>
          )}

          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Parameters</h4>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Location</th>
                      <th className="px-4 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((param) => (
                      <tr key={param.name} className="border-t">
                        <td className="px-4 py-2 font-mono">
                          {param.name}
                          {param.required && <span className="text-red-500">*</span>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{param.type}</td>
                        <td className="px-4 py-2 text-muted-foreground">{param.location}</td>
                        <td className="px-4 py-2">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className="font-medium mb-2">Request Body</h4>
              <CodeBlock code={endpoint.requestBody.example} language="json" />
            </div>
          )}

          {endpoint.response && (
            <div>
              <h4 className="font-medium mb-2">
                Response ({endpoint.response.status})
              </h4>
              <CodeBlock code={endpoint.response.example} language="json" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function APIDocumentation() {
  const [activeSection, setActiveSection] = useState(API_SECTIONS[0].name);

  return (
    <div className="flex gap-6">
      <nav className="w-64 shrink-0 hidden lg:block">
        <div className="sticky top-4 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 font-semibold">
            <Book className="w-5 h-5" />
            API Reference
          </div>
          {API_SECTIONS.map((section) => (
            <button
              key={section.name}
              onClick={() => setActiveSection(section.name)}
              className={`w-full px-3 py-2 text-left rounded transition-colors ${
                activeSection === section.name
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {section.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 min-w-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete reference for the ResearchFlow API
          </p>
        </div>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-medium mb-2">Base URL</h3>
          <code className="text-sm bg-background px-2 py-1 rounded">
            https://api.researchflow.io/v1
          </code>
        </div>

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Code className="w-4 h-4" />
            Authentication
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            Include your API token in the Authorization header:
          </p>
          <code className="text-sm">Authorization: Bearer YOUR_API_TOKEN</code>
        </div>

        {API_SECTIONS.filter((s) => s.name === activeSection).map((section) => (
          <div key={section.name} className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">{section.name}</h2>
              <p className="text-muted-foreground">{section.description}</p>
            </div>

            <div className="space-y-3">
              {section.endpoints.map((endpoint, index) => (
                <EndpointCard key={index} endpoint={endpoint} />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
