/**
 * AI Provider Routes
 * Task 141 - Extensibility hooks for custom AI models
 */

import { Router, Request, Response } from 'express';
import {
  listProviders,
  getProvider,
  registerCustomProvider,
  unregisterCustomProvider,
  configureProvider,
  getProviderConfig,
  enableProviderForTenant,
  disableProviderForTenant,
  listTenantProviders,
  findBestProvider,
  getModelInfo,
  invoke,
  recordUsage,
  getUsageSummary,
  ModelCapability,
} from '../services/aiProviderService';

export const aiProvidersRouter = Router();

// ─────────────────────────────────────────────────────────────
// Provider Discovery
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/providers
 * List all available AI providers
 */
aiProvidersRouter.get('/', (req: Request, res: Response) => {
  try {
    const capability = req.query.capability as ModelCapability | undefined;
    const includeCustom = req.query.includeCustom !== 'false';

    const providers = listProviders({ capability, includeCustom });

    // Don't expose sensitive info
    const safeProviders = providers.map(p => ({
      id: p.id,
      displayName: p.displayName,
      description: p.description,
      capabilities: p.capabilities,
      models: p.models.map(m => ({
        id: m.id,
        name: m.name,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
      })),
      status: p.status,
      isBuiltIn: p.isBuiltIn,
      isCustom: p.isCustom,
    }));

    res.json(safeProviders);
  } catch (error) {
    console.error('Error listing providers:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

/**
 * GET /api/ai/providers/:id
 * Get provider details
 */
aiProvidersRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const provider = getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Return safe info (no internal config schemas with sensitive defaults)
    res.json({
      id: provider.id,
      displayName: provider.displayName,
      description: provider.description,
      capabilities: provider.capabilities,
      models: provider.models,
      authType: provider.authType,
      status: provider.status,
      isBuiltIn: provider.isBuiltIn,
      isCustom: provider.isCustom,
      configSchema: provider.configSchema, // Schema is safe to expose
    });
  } catch (error) {
    console.error('Error getting provider:', error);
    res.status(500).json({ error: 'Failed to get provider' });
  }
});

/**
 * GET /api/ai/providers/:providerId/models/:modelId
 * Get model details
 */
aiProvidersRouter.get('/:providerId/models/:modelId', (req: Request, res: Response) => {
  try {
    const model = getModelInfo(req.params.providerId, req.params.modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json(model);
  } catch (error) {
    console.error('Error getting model:', error);
    res.status(500).json({ error: 'Failed to get model' });
  }
});

// ─────────────────────────────────────────────────────────────
// Custom Provider Registration
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/providers
 * Register a custom AI provider
 */
aiProvidersRouter.post('/', (req: Request, res: Response) => {
  try {
    const {
      id,
      displayName,
      description,
      capabilities,
      models,
      authType,
      baseUrl,
      configSchema,
    } = req.body;

    if (!id || !displayName || !capabilities || !models) {
      return res.status(400).json({
        error: 'Missing required fields: id, displayName, capabilities, models',
      });
    }

    const provider = registerCustomProvider({
      id,
      displayName,
      description,
      capabilities,
      models,
      authType: authType ?? 'API_KEY',
      baseUrl,
      status: 'INACTIVE',
      configSchema,
    });

    res.status(201).json(provider);
  } catch (error: any) {
    console.error('Error registering provider:', error);
    res.status(400).json({ error: error.message ?? 'Failed to register provider' });
  }
});

/**
 * DELETE /api/ai/providers/:id
 * Unregister a custom provider
 */
aiProvidersRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const success = unregisterCustomProvider(req.params.id);
    if (!success) {
      return res.status(400).json({
        error: 'Cannot unregister: provider not found or is built-in',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unregistering provider:', error);
    res.status(500).json({ error: 'Failed to unregister provider' });
  }
});

// ─────────────────────────────────────────────────────────────
// Tenant Configuration
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/tenant/providers
 * List providers with tenant configuration status
 */
aiProvidersRouter.get('/tenant/providers', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const result = listTenantProviders(tenantId);

    // Return safe info
    const safeResult = result.map(({ provider, config }) => ({
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        capabilities: provider.capabilities,
        models: provider.models.map(m => ({
          id: m.id,
          name: m.name,
          capabilities: m.capabilities,
        })),
        status: provider.status,
        isBuiltIn: provider.isBuiltIn,
      },
      configured: !!config,
      enabled: config?.enabled ?? false,
      defaultModel: config?.defaultModel,
    }));

    res.json(safeResult);
  } catch (error) {
    console.error('Error listing tenant providers:', error);
    res.status(500).json({ error: 'Failed to list tenant providers' });
  }
});

/**
 * PUT /api/ai/providers/:id/configure
 * Configure a provider for the tenant
 */
aiProvidersRouter.put('/:id/configure', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const { credentials, settings } = req.body;

    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'Credentials object required' });
    }

    const config = configureProvider(
      req.params.id,
      tenantId,
      credentials,
      settings
    );

    // Don't return actual credentials
    res.json({
      providerId: config.providerId,
      tenantId: config.tenantId,
      enabled: config.enabled,
      settings: config.settings,
      defaultModel: config.defaultModel,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    console.error('Error configuring provider:', error);
    res.status(400).json({ error: error.message ?? 'Failed to configure provider' });
  }
});

/**
 * GET /api/ai/providers/:id/config
 * Get provider configuration (without credentials)
 */
aiProvidersRouter.get('/:id/config', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const config = getProviderConfig(req.params.id, tenantId);

    if (!config) {
      return res.status(404).json({ error: 'Provider not configured' });
    }

    // Don't return credentials
    res.json({
      providerId: config.providerId,
      enabled: config.enabled,
      settings: config.settings,
      defaultModel: config.defaultModel,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      hasCredentials: Object.keys(config.credentials).length > 0,
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * POST /api/ai/providers/:id/enable
 * Enable a provider for the tenant
 */
aiProvidersRouter.post('/:id/enable', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const config = enableProviderForTenant(req.params.id, tenantId);

    if (!config) {
      return res.status(404).json({
        error: 'Provider not configured. Configure it first with credentials.',
      });
    }

    res.json({ enabled: true, providerId: config.providerId });
  } catch (error) {
    console.error('Error enabling provider:', error);
    res.status(500).json({ error: 'Failed to enable provider' });
  }
});

/**
 * POST /api/ai/providers/:id/disable
 * Disable a provider for the tenant
 */
aiProvidersRouter.post('/:id/disable', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const config = disableProviderForTenant(req.params.id, tenantId);

    if (!config) {
      return res.status(404).json({ error: 'Provider not configured' });
    }

    res.json({ enabled: false, providerId: config.providerId });
  } catch (error) {
    console.error('Error disabling provider:', error);
    res.status(500).json({ error: 'Failed to disable provider' });
  }
});

// ─────────────────────────────────────────────────────────────
// Model Invocation
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/invoke
 * Invoke an AI model
 */
aiProvidersRouter.post('/invoke', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const {
      capability,
      providerId,
      model,
      messages,
      prompt,
      temperature,
      maxTokens,
      tools,
    } = req.body;

    if (!capability) {
      return res.status(400).json({ error: 'Capability is required' });
    }

    const response = await invoke(tenantId, {
      capability,
      providerId,
      model,
      messages,
      prompt,
      temperature,
      maxTokens,
      tools,
    });

    // Record usage
    recordUsage(tenantId, response);

    res.json(response);
  } catch (error: any) {
    console.error('Error invoking model:', error);
    res.status(400).json({ error: error.message ?? 'Failed to invoke model' });
  }
});

/**
 * POST /api/ai/chat
 * Convenience endpoint for chat completion
 */
aiProvidersRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const { messages, providerId, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await invoke(tenantId, {
      capability: 'CHAT',
      providerId,
      model,
      messages,
      temperature,
      maxTokens,
    });

    recordUsage(tenantId, response);

    res.json({
      content: response.outputText,
      model: response.model,
      provider: response.providerId,
      usage: response.usage,
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    res.status(400).json({ error: error.message ?? 'Failed to complete chat' });
  }
});

/**
 * POST /api/ai/embeddings
 * Generate embeddings
 */
aiProvidersRouter.post('/embeddings', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const { text, providerId, model } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await invoke(tenantId, {
      capability: 'EMBEDDINGS',
      providerId,
      model,
      prompt: text,
    });

    recordUsage(tenantId, response);

    res.json({
      embeddings: response.embeddings,
      model: response.model,
      provider: response.providerId,
      dimensions: response.embeddings?.length,
    });
  } catch (error: any) {
    console.error('Error generating embeddings:', error);
    res.status(400).json({ error: error.message ?? 'Failed to generate embeddings' });
  }
});

// ─────────────────────────────────────────────────────────────
// Usage Analytics
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/ai/usage
 * Get AI usage summary for tenant
 */
aiProvidersRouter.get('/usage', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const summary = getUsageSummary(tenantId, { startDate, endDate });
    res.json(summary);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage summary' });
  }
});

/**
 * GET /api/ai/best-provider
 * Find the best available provider for a capability
 */
aiProvidersRouter.get('/best-provider', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const capability = req.query.capability as ModelCapability;
    const preferredProvider = req.query.preferredProvider as string | undefined;

    if (!capability) {
      return res.status(400).json({ error: 'Capability is required' });
    }

    const result = findBestProvider(tenantId, capability, preferredProvider);

    if (!result) {
      return res.status(404).json({
        error: `No provider available for capability: ${capability}`,
        suggestion: 'Configure and enable a provider with this capability',
      });
    }

    res.json({
      providerId: result.provider.id,
      providerName: result.provider.displayName,
      model: result.model,
      capabilities: result.provider.capabilities,
    });
  } catch (error) {
    console.error('Error finding provider:', error);
    res.status(500).json({ error: 'Failed to find provider' });
  }
});

export default aiProvidersRouter;
