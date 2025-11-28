import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  extractEmailDomain,
  parseAllowedDomains,
  isEmailDomainAllowed,
} from "./utils.js";

describe("Domain Validation Utilities", () => {
  describe("Property-Based Tests", () => {
    /**
     * Feature: domain-restricted-registration, Property 1: Domain parsing normalization
     * Validates: Requirements 1.1, 1.3
     */
    it("Property 1: Domain parsing normalization - should trim whitespace and lowercase all domains", () => {
      fc.assert(
        fc.property(
          fc.array(fc.domain(), { minLength: 1, maxLength: 10 }),
          fc.array(fc.constantFrom(" ", "  ", "\t", "\n"), { maxLength: 3 }),
          (domains, whitespaces) => {
            // Generate a comma-separated string with random whitespace
            const domainsWithWhitespace = domains.map((domain, idx) => {
              const before = whitespaces[idx % whitespaces.length] || "";
              const after = whitespaces[(idx + 1) % whitespaces.length] || "";
              // Mix case randomly
              const mixedCase = domain
                .split("")
                .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char))
                .join("");
              return `${before}${mixedCase}${after}`;
            });
            
            const input = domainsWithWhitespace.join(",");
            const result = parseAllowedDomains(input);
            
            // All results should be trimmed and lowercased
            result.forEach((domain) => {
              expect(domain).toBe(domain.trim());
              expect(domain).toBe(domain.toLowerCase());
              expect(domain).not.toMatch(/^\s|\s$/); // No leading/trailing whitespace
            });
            
            // Should have same length as input (no domains lost)
            expect(result.length).toBe(domains.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: domain-restricted-registration, Property 2: Invalid domain filtering
     * Validates: Requirements 1.4
     */
    it("Property 2: Invalid domain filtering - should filter out invalid domains and keep valid ones", () => {
      fc.assert(
        fc.property(
          fc.array(fc.domain(), { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.constantFrom(
              "invalid..domain",
              "-invalid",
              "invalid-",
              ".invalid",
              "invalid.",
              "inv@lid",
              "inv alid"
            ),
            { minLength: 1, maxLength: 5 }
          ),
          (validDomains, invalidDomains) => {
            // Mix valid and invalid domains
            const allDomains = [...validDomains, ...invalidDomains];
            // Shuffle the array
            for (let i = allDomains.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [allDomains[i], allDomains[j]] = [allDomains[j], allDomains[i]];
            }
            
            const input = allDomains.join(",");
            const result = parseAllowedDomains(input);
            
            // Result should only contain valid domains
            expect(result.length).toBeLessThanOrEqual(validDomains.length);
            
            // All results should be valid domain format
            const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
            result.forEach((domain) => {
              expect(domainRegex.test(domain)).toBe(true);
            });
            
            // All valid domains should be in the result (lowercased)
            const resultSet = new Set(result);
            validDomains.forEach((domain) => {
              expect(resultSet.has(domain.toLowerCase())).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: domain-restricted-registration, Property 6: Case-insensitive domain matching
     * Validates: Requirements 2.4
     */
    it("Property 6: Case-insensitive domain matching - should match domains regardless of case", () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (domain) => {
            // Create an email with mixed case
            const mixedCaseEmail = `user@${domain}`
              .split("")
              .map((char) => (Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase()))
              .join("");
            
            // Create the domain config string with random mixed casing
            const mixedCaseDomainString = domain
              .split("")
              .map((char) => (Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase()))
              .join("");
            
            // Parse the domains (this will normalize them)
            const normalizedDomains = parseAllowedDomains(mixedCaseDomainString);
            
            // Should be allowed regardless of case in email or config
            const result = isEmailDomainAllowed(mixedCaseEmail, normalizedDomains);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: domain-restricted-registration, Property 9: Boolean validation result
     * Validates: Requirements 4.1
     */
    it("Property 9: Boolean validation result - should always return a boolean", () => {
      fc.assert(
        fc.property(
          fc.option(fc.emailAddress(), { nil: null }),
          fc.array(fc.domain(), { maxLength: 10 }),
          (email, domains) => {
            const result = isEmailDomainAllowed(email, domains);
            expect(typeof result).toBe("boolean");
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: domain-restricted-registration, Property 10: Empty whitelist allows all
     * Validates: Requirements 4.3
     */
    it("Property 10: Empty whitelist allows all - should return true for any valid email when whitelist is empty", () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            // Test with empty array
            const resultEmptyArray = isEmailDomainAllowed(email, []);
            expect(resultEmptyArray).toBe(true);
            
            // Test with null
            const resultNull = isEmailDomainAllowed(email, null);
            expect(resultNull).toBe(true);
            
            // Test with undefined
            const resultUndefined = isEmailDomainAllowed(email, undefined);
            expect(resultUndefined).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Unit Tests - extractEmailDomain", () => {
    it("should return null for null email", () => {
      expect(extractEmailDomain(null)).toBe(null);
    });

    it("should return null for undefined email", () => {
      expect(extractEmailDomain(undefined)).toBe(null);
    });

    it("should extract domain from rightmost @ symbol", () => {
      expect(extractEmailDomain("user@@example.com")).toBe("example.com");
      expect(extractEmailDomain("user@name@example.com")).toBe("example.com");
    });

    it("should return null for email without @ symbol", () => {
      expect(extractEmailDomain("userexample.com")).toBe(null);
      expect(extractEmailDomain("invalid")).toBe(null);
    });

    it("should return null for empty string", () => {
      expect(extractEmailDomain("")).toBe(null);
      expect(extractEmailDomain("   ")).toBe(null);
    });

    it("should lowercase the extracted domain", () => {
      expect(extractEmailDomain("user@EXAMPLE.COM")).toBe("example.com");
      expect(extractEmailDomain("user@Example.Com")).toBe("example.com");
    });
  });

  describe("Unit Tests - parseAllowedDomains", () => {
    it("should return empty array for empty string", () => {
      expect(parseAllowedDomains("")).toEqual([]);
      expect(parseAllowedDomains("   ")).toEqual([]);
    });

    it("should return empty array for null", () => {
      expect(parseAllowedDomains(null)).toEqual([]);
    });

    it("should return empty array for undefined", () => {
      expect(parseAllowedDomains(undefined)).toEqual([]);
    });

    it("should return array with one element for single domain", () => {
      expect(parseAllowedDomains("example.com")).toEqual(["example.com"]);
    });

    it("should trim whitespace from domains", () => {
      expect(parseAllowedDomains("  example.com  ,  test.org  ")).toEqual([
        "example.com",
        "test.org",
      ]);
      expect(parseAllowedDomains("example.com, test.org, another.net")).toEqual([
        "example.com",
        "test.org",
        "another.net",
      ]);
    });

    it("should lowercase all domains", () => {
      expect(parseAllowedDomains("EXAMPLE.COM,Test.ORG")).toEqual([
        "example.com",
        "test.org",
      ]);
    });

    it("should filter out invalid domains", () => {
      expect(parseAllowedDomains("example.com,invalid.,test.org")).toEqual([
        "example.com",
        "test.org",
      ]);
    });
  });
});
