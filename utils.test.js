import { describe, it, expect } from 'vitest';
import { matchesRange } from './utils';

describe('matchesRange', () => {
  describe('CIDR notation', () => {
    it('should match IPs within a /24 subnet', () => {
      expect(matchesRange('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.1.255', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.1.0', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.2.100', '192.168.1.0/24')).toBe(false);
    });

    it('should match IPs within a /16 subnet', () => {
      expect(matchesRange('192.168.1.100', '192.168.0.0/16')).toBe(true);
      expect(matchesRange('192.168.255.255', '192.168.0.0/16')).toBe(true);
      expect(matchesRange('192.169.1.100', '192.168.0.0/16')).toBe(false);
    });

    it('should match IPs within a /8 subnet', () => {
      expect(matchesRange('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(matchesRange('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(matchesRange('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('should match IPs within a /32 subnet (single IP)', () => {
      expect(matchesRange('192.168.1.1', '192.168.1.1/32')).toBe(true);
      expect(matchesRange('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });

    it('should match IPs within a /0 subnet (all IPs)', () => {
      expect(matchesRange('0.0.0.0', '0.0.0.0/0')).toBe(true);
      expect(matchesRange('255.255.255.255', '0.0.0.0/0')).toBe(true);
      expect(matchesRange('192.168.1.1', '0.0.0.0/0')).toBe(true);
    });

    it('should handle edge cases for subnet boundaries', () => {
      expect(matchesRange('192.168.1.0', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.1.255', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.0.255', '192.168.1.0/24')).toBe(false);
      expect(matchesRange('192.168.2.0', '192.168.1.0/24')).toBe(false);
    });

    it('should return false for invalid CIDR prefix lengths', () => {
      expect(matchesRange('192.168.1.1', '192.168.1.0/33')).toBe(false);
      expect(matchesRange('192.168.1.1', '192.168.1.0/-1')).toBe(false);
      expect(matchesRange('192.168.1.1', '192.168.1.0/abc')).toBe(false);
    });

    it('should return false for invalid IP addresses', () => {
      expect(matchesRange('invalid', '192.168.1.0/24')).toBe(false);
      expect(matchesRange('192.168.1.256', '192.168.1.0/24')).toBe(false);
      expect(matchesRange('192.168.1', '192.168.1.0/24')).toBe(false);
      expect(matchesRange('192.168.1.1', 'invalid/24')).toBe(false);
    });
  });

  describe('Backward compatibility (substring matching)', () => {
    it('should match IPs using substring matching when no CIDR notation', () => {
      expect(matchesRange('192.168.1.100', '192.168')).toBe(true);
      expect(matchesRange('192.168.1.100', '192.168.1')).toBe(true);
      expect(matchesRange('192.168.1.100', '192.168.1.100')).toBe(true);
      expect(matchesRange('192.168.1.100', '192.169')).toBe(false);
    });

    it('should handle partial address matching', () => {
      expect(matchesRange('10.20.30.40', '10.20')).toBe(true);
      expect(matchesRange('10.20.30.40', '10.21')).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should match common private network ranges', () => {
      // Private network 10.0.0.0/8
      expect(matchesRange('10.1.2.3', '10.0.0.0/8')).toBe(true);

      // Private network 172.16.0.0/12
      expect(matchesRange('172.16.0.1', '172.16.0.0/12')).toBe(true);
      expect(matchesRange('172.31.255.255', '172.16.0.0/12')).toBe(true);
      expect(matchesRange('172.32.0.1', '172.16.0.0/12')).toBe(false);

      // Private network 192.168.0.0/16
      expect(matchesRange('192.168.1.1', '192.168.0.0/16')).toBe(true);
    });

    it('should handle different base IPs in same subnet', () => {
      expect(matchesRange('192.168.1.50', '192.168.1.0/24')).toBe(true);
      expect(matchesRange('192.168.1.50', '192.168.1.100/24')).toBe(true);
      expect(matchesRange('192.168.1.50', '192.168.1.255/24')).toBe(true);
    });
  });
});
