/**
 * Tests for Plugin Marketplace Service
 * Task 137 - Plugin marketplace for third-party extensions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listPlugins,
  getPlugin,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  getInstallation,
  getAuditLog,
} from '../pluginMarketplaceService';

describe('PluginMarketplaceService', () => {
  const tenantId = 'test-tenant';
  const userId = 'test-user';

  describe('listPlugins', () => {
    it('should return all plugins by default', () => {
      const plugins = listPlugins();
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0]).toHaveProperty('id');
      expect(plugins[0]).toHaveProperty('name');
      expect(plugins[0]).toHaveProperty('manifest');
    });

    it('should filter by category', () => {
      const plugins = listPlugins({ category: 'ANALYSIS' });
      expect(plugins.every(p => p.category === 'ANALYSIS')).toBe(true);
    });

    it('should filter verified plugins only', () => {
      const plugins = listPlugins({ verified: true });
      expect(plugins.every(p => p.verified === true)).toBe(true);
    });

    it('should search by query term', () => {
      const plugins = listPlugins({ search: 'statistical' });
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some(p =>
        p.name.toLowerCase().includes('statistical') ||
        p.description.toLowerCase().includes('statistical')
      )).toBe(true);
    });
  });

  describe('getPlugin', () => {
    it('should return plugin by id', () => {
      const plugins = listPlugins();
      const plugin = getPlugin(plugins[0].id);
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe(plugins[0].id);
    });

    it('should return undefined for unknown plugin', () => {
      const plugin = getPlugin('non-existent-plugin');
      expect(plugin).toBeUndefined();
    });
  });

  describe('installPlugin', () => {
    it('should install a plugin successfully', () => {
      const plugins = listPlugins();
      const installation = installPlugin(plugins[0].id, tenantId, userId);

      expect(installation).toBeDefined();
      expect(installation.pluginId).toBe(plugins[0].id);
      expect(installation.tenantId).toBe(tenantId);
      expect(installation.installedBy).toBe(userId);
      expect(installation.enabled).toBe(true);
    });

    it('should throw error for unknown plugin', () => {
      expect(() => installPlugin('non-existent', tenantId, userId))
        .toThrow('Plugin not found');
    });

    it('should allow configuration during installation', () => {
      const plugins = listPlugins();
      const config = { apiKey: 'test-key' };
      const installation = installPlugin(plugins[0].id, tenantId, userId, config);

      expect(installation.config).toEqual(config);
    });
  });

  describe('enablePlugin / disablePlugin', () => {
    it('should enable a disabled plugin', () => {
      const plugins = listPlugins();
      installPlugin(plugins[0].id, tenantId, userId);
      disablePlugin(plugins[0].id, tenantId, userId);

      const enabled = enablePlugin(plugins[0].id, tenantId, userId);
      expect(enabled?.enabled).toBe(true);
    });

    it('should disable an enabled plugin', () => {
      const plugins = listPlugins();
      installPlugin(plugins[0].id, tenantId, userId);

      const disabled = disablePlugin(plugins[0].id, tenantId, userId);
      expect(disabled?.enabled).toBe(false);
    });
  });

  describe('uninstallPlugin', () => {
    it('should uninstall a plugin', () => {
      const plugins = listPlugins();
      installPlugin(plugins[0].id, tenantId, userId);

      const success = uninstallPlugin(plugins[0].id, tenantId, userId);
      expect(success).toBe(true);

      const installation = getInstallation(plugins[0].id, tenantId);
      expect(installation).toBeUndefined();
    });

    it('should return false for non-installed plugin', () => {
      const success = uninstallPlugin('non-installed', tenantId, userId);
      expect(success).toBe(false);
    });
  });

  describe('getAuditLog', () => {
    it('should record installation actions', () => {
      const plugins = listPlugins();
      installPlugin(plugins[0].id, `audit-${tenantId}`, userId);

      const logs = getAuditLog({ tenantId: `audit-${tenantId}` });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.action === 'INSTALL')).toBe(true);
    });

    it('should filter by pluginId', () => {
      const plugins = listPlugins();
      installPlugin(plugins[0].id, `filter-${tenantId}`, userId);

      const logs = getAuditLog({ pluginId: plugins[0].id });
      expect(logs.every(l => l.pluginId === plugins[0].id)).toBe(true);
    });
  });
});
