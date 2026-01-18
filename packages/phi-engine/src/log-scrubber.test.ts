/**
 * Log Scrubber Test Suite
 * 
 * Comprehensive tests for PHI log scrubbing functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { scrubLog, scrubObject, containsPhi, getPhiStats } from './log-scrubber';

describe('log-scrubber', () => {
  describe('scrubLog', () => {
    it('should redact SSN patterns', () => {
      const message = 'Patient SSN: 123-45-6789';
      const result = scrubLog(message);
      expect(result).toBe('Patient SSN: [REDACTED:SSN]');
    });

    it('should redact SSN without dashes', () => {
      const message = 'SSN: 123456789';
      const result = scrubLog(message);
      expect(result).toBe('SSN: [REDACTED:SSN]');
    });

    it('should redact email patterns', () => {
      const message = 'Contact: john.doe@example.com for details';
      const result = scrubLog(message);
      expect(result).toBe('Contact: [REDACTED:EMAIL] for details');
    });

    it('should redact phone patterns with parentheses', () => {
      const message = 'Call (555) 123-4567';
      const result = scrubLog(message);
      expect(result).toBe('Call ([REDACTED:PHONE]');
    });

    it('should redact phone patterns with dashes', () => {
      const message = 'Phone: 555-123-4567';
      const result = scrubLog(message);
      expect(result).toBe('Phone: [REDACTED:PHONE]');
    });

    it('should redact phone patterns with dots', () => {
      const message = 'Tel: 555.123.4567';
      const result = scrubLog(message);
      expect(result).toBe('Tel: [REDACTED:PHONE]');
    });

    it('should redact MRN patterns', () => {
      const message = 'MRN: MRN12345678';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:MRN]');
    });

    it('should redact medical record references', () => {
      const message = 'Medical Record: ABC123456';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:MRN]');
    });

    it('should redact IP addresses', () => {
      const message = 'Server IP: 192.168.1.1';
      const result = scrubLog(message);
      expect(result).toBe('Server IP: [REDACTED:IP_ADDRESS]');
    });

    it('should redact ZIP codes', () => {
      const message = 'Address ZIP: 12345';
      const result = scrubLog(message);
      expect(result).toBe('Address ZIP: [REDACTED:ZIP_CODE]');
    });

    it('should redact ZIP+4 codes', () => {
      const message = 'ZIP: 12345-6789';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED');
    });

    it('should handle mixed content with multiple PHI types', () => {
      const message = 'Patient: SSN 123-45-6789, Email: test@example.com, Phone: 555-1234';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:SSN]');
      expect(result).toContain('[REDACTED:EMAIL]');
      expect(result).not.toContain('123-45-6789');
      expect(result).not.toContain('test@example.com');
    });

    it('should handle empty strings', () => {
      expect(scrubLog('')).toBe('');
    });

    it('should handle strings without PHI', () => {
      const message = 'No sensitive data here';
      expect(scrubLog(message)).toBe(message);
    });

    it('should handle multiple occurrences of same PHI type', () => {
      const message = 'Email1: a@b.com, Email2: c@d.com';
      const result = scrubLog(message);
      expect(result).toBe('Email1: [REDACTED:EMAIL], Email2: [REDACTED:EMAIL]');
    });

    it('should redact dates in various formats', () => {
      expect(scrubLog('DOB: 01/15/1990')).toContain('[REDACTED:DOB]');
      expect(scrubLog('Date: 2020-03-15')).toContain('[REDACTED:DOB]');
      expect(scrubLog('Born: January 1, 1990')).toContain('[REDACTED:DOB]');
    });

    it('should redact URLs', () => {
      const message = 'Visit https://patient-portal.example.com/profile';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:URL]');
    });

    it('should redact names with titles', () => {
      const message = 'Dr. John Smith performed the surgery';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:NAME]');
    });

    it('should redact street addresses', () => {
      const message = 'Lives at 123 Main Street';
      const result = scrubLog(message);
      expect(result).toContain('[REDACTED:ADDRESS]');
    });
  });

  describe('scrubObject', () => {
    it('should scrub string values in flat objects', () => {
      const obj = {
        name: 'Test',
        ssn: '123-45-6789',
        phone: '555-1234'
      };
      const result = scrubObject(obj);
      expect(result.ssn).toBe('[REDACTED:SSN]');
      expect(result.name).toBe('Test');
    });

    it('should scrub nested objects recursively', () => {
      const obj = {
        patient: {
          personal: {
            ssn: '123-45-6789',
            email: 'patient@example.com'
          }
        }
      };
      const result = scrubObject(obj);
      expect(result.patient.personal.ssn).toBe('[REDACTED:SSN]');
      expect(result.patient.personal.email).toBe('[REDACTED:EMAIL]');
    });

    it('should scrub arrays', () => {
      const obj = {
        contacts: ['john@example.com', 'jane@example.com']
      };
      const result = scrubObject(obj);
      expect(result.contacts[0]).toBe('[REDACTED:EMAIL]');
      expect(result.contacts[1]).toBe('[REDACTED:EMAIL]');
    });

    it('should handle arrays of objects', () => {
      const obj = {
        patients: [
          { ssn: '111-11-1111' },
          { ssn: '222-22-2222' }
        ]
      };
      const result = scrubObject(obj);
      expect(result.patients[0].ssn).toBe('[REDACTED:SSN]');
      expect(result.patients[1].ssn).toBe('[REDACTED:SSN]');
    });

    it('should handle null values', () => {
      const obj = { value: null };
      const result = scrubObject(obj);
      expect(result.value).toBeNull();
    });

    it('should handle undefined values', () => {
      const obj = { value: undefined };
      const result = scrubObject(obj);
      expect(result.value).toBeUndefined();
    });

    it('should handle numbers', () => {
      const obj = { count: 42 };
      const result = scrubObject(obj);
      expect(result.count).toBe(42);
    });

    it('should handle booleans', () => {
      const obj = { active: true };
      const result = scrubObject(obj);
      expect(result.active).toBe(true);
    });

    it('should handle dates', () => {
      const date = new Date('2020-01-01');
      const obj = { timestamp: date };
      const result = scrubObject(obj);
      expect(result.timestamp).toEqual(date);
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      const result = scrubObject(obj);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should scrub keys containing PHI', () => {
      const obj = {
        'patient-123-45-6789': 'value'
      };
      const result = scrubObject(obj);
      const keys = Object.keys(result);
      expect(keys[0]).toContain('[REDACTED:SSN]');
    });

    it('should handle empty objects', () => {
      const result = scrubObject({});
      expect(result).toEqual({});
    });

    it('should handle deeply nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                ssn: '123-45-6789'
              }
            }
          }
        }
      };
      const result = scrubObject(obj);
      expect(result.level1.level2.level3.level4.ssn).toBe('[REDACTED:SSN]');
    });

    it('should preserve non-PHI data structure', () => {
      const obj = {
        id: 123,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: {
          created: 'January 15, 2020',
          note: 'Some non-date text'
        }
      };
      const result = scrubObject(obj);
      expect(result.id).toBe(123);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.metadata.note).toBe('Some non-date text');
    });
  });

  describe('containsPhi', () => {
    it('should return true for messages with SSN', () => {
      expect(containsPhi('SSN: 123-45-6789')).toBe(true);
    });

    it('should return true for messages with email', () => {
      expect(containsPhi('Contact: test@example.com')).toBe(true);
    });

    it('should return false for messages without PHI', () => {
      expect(containsPhi('This is a safe message')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(containsPhi('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(containsPhi(null as any)).toBe(false);
      expect(containsPhi(undefined as any)).toBe(false);
    });
  });

  describe('getPhiStats', () => {
    it('should count PHI types in message', () => {
      const message = 'SSN: 123-45-6789, Email: test@example.com';
      const stats = getPhiStats(message);
      expect(stats.SSN).toBe(1);
      expect(stats.EMAIL).toBe(1);
    });

    it('should count multiple occurrences', () => {
      const message = 'Email1: a@b.com, Email2: c@d.com, Email3: e@f.com';
      const stats = getPhiStats(message);
      expect(stats.EMAIL).toBe(3);
    });

    it('should return empty object for non-PHI messages', () => {
      const stats = getPhiStats('No PHI here');
      expect(stats).toEqual({});
    });

    it('should handle empty strings', () => {
      const stats = getPhiStats('');
      expect(stats).toEqual({});
    });
  });

  describe('performance', () => {
    it('should scrub 10,000 messages in under 1 second', () => {
      const testMessage = 'Patient SSN: 123-45-6789, Email: test@example.com, Phone: (555) 123-4567';
      const iterations = 10000;

      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        scrubLog(testMessage);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in less than 1 second (1000ms)
      expect(duration).toBeLessThan(1000);
      
      // Log performance for visibility
      console.log(`Scrubbed ${iterations} messages in ${duration.toFixed(2)}ms`);
      console.log(`Average: ${(duration / iterations).toFixed(4)}ms per message`);
    });

    it('should scrub 10,000 objects in under 1 second', () => {
      const testObject = {
        patient: {
          ssn: '123-45-6789',
          email: 'test@example.com',
          phone: '555-123-4567',
          address: '123 Main Street'
        }
      };
      const iterations = 10000;

      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        scrubObject(testObject);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in less than 1 second (1000ms)
      expect(duration).toBeLessThan(1000);
      
      console.log(`Scrubbed ${iterations} objects in ${duration.toFixed(2)}ms`);
      console.log(`Average: ${(duration / iterations).toFixed(4)}ms per object`);
    });
  });
});
