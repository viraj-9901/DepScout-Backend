/**
 * Type definitions for Dependency Analyzer
 */

export interface DependencyReport {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  healthScore: number;
  outdated: OutdatedPackage[];
  summary: Summary;
  totalDependencies: number;
  vulnerabilities: Vulnerability[];
}

export interface OutdatedPackage {
  package: string;
  current: string;
  latest: string;
  type: 'major' | 'minor' | 'patch';
}

export interface Vulnerability {
  id: string;
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'unknown';
  description: string;
  fixedIn: string;
}

export interface Summary {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  outdated: number;
  totalDeps: number;
  totalDevDeps: number;
}

export interface NpmOutdatedInfo {
  current: string;
  wanted: string;
  latest: string;
  location: string;
}

export interface VersionDistance {
  majorVersionsBehind: number;
  minorVersionsBehind: number;
  patchVersionsBehind: number;
  totalDistance: number;
}

export interface VersionAnalysis {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[] | null;
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
