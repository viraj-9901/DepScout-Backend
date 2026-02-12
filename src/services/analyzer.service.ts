import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';

const execPromise = promisify(exec);

// ========================================
// TYPES & INTERFACES
// ========================================

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

// ========================================
// SERVICE CLASS
// ========================================

export class AnalyzerService {
  private packageJsonPath: string;

  constructor(packageJsonPath?: string) {
    this.packageJsonPath = packageJsonPath || path.join(process.cwd(), 'package.json');
  }

  /**
   * Main method to generate dependency report
   */
  public async generateDependencyReport(packageJson?: any): Promise<DependencyReport> {
    try {
      // Validate package.json exists
      // if (!fs.existsSync(this.packageJsonPath)) {
      //   throw new Error(`package.json not found at ${this.packageJsonPath}`);
      // }

      // // Read package.json
      // const packageJson = this.readPackageJson();
      console.log('Generating report for package.json:', packageJson);

      // Get npm data
      const [npmOutdated, npmAudit] = await Promise.all([
        // this.getNpmOutdated(),
        this.getOutdatedFast(packageJson),
        this.getNpmAudit()
      ]);

      // Build the report
      const report: DependencyReport = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        healthScore: 100,
        outdated: this.buildOutdatedList(npmOutdated, packageJson),
        summary: {
          critical: 0,
          high: 0,
          moderate: 0,
          low: 0,
          outdated: 0,
          totalDeps: Object.keys(packageJson.dependencies || {}).length,
          totalDevDeps: Object.keys(packageJson.devDependencies || {}).length
        },
        totalDependencies: 0,
        vulnerabilities: []
      };

      // Process vulnerabilities
      report.vulnerabilities = this.processVulnerabilities(npmAudit);

      // Update summary counts
      report.summary.critical = report.vulnerabilities.filter(v => v.severity === 'critical').length;
      report.summary.high = report.vulnerabilities.filter(v => v.severity === 'high').length;
      report.summary.moderate = report.vulnerabilities.filter(v => v.severity === 'moderate').length;
      report.summary.low = report.vulnerabilities.filter(v => v.severity === 'low').length;
      report.summary.outdated = report.outdated.length;
      report.totalDependencies = report.summary.totalDeps + report.summary.totalDevDeps;

      // Calculate health score
      report.healthScore = this.calculateHealthScore(report);

      return report;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate dependency report: ${error.message}`);
      }
      throw new Error('Failed to generate dependency report: Unknown error');
    }
  }

  /**
   * Save report to file
   */
  public async saveReportToFile(report: DependencyReport, outputPath?: string): Promise<string> {
    try {
      const filePath = outputPath || path.join(process.cwd(), 'dependency-report.json');
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      return filePath;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save report to file: ${error.message}`);
      }
      throw new Error('Failed to save report to file: Unknown error');
    }
  }

  // ========================================
  // PRIVATE METHODS - NPM COMMANDS
  // ========================================

  // private readPackageJson(): any {
  //   try {
  //     const content = fs.readFileSync(this.packageJsonPath, 'utf8');
  //     return JSON.parse(content);
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       throw new Error(`Failed to read package.json: ${error.message}`);
  //     }
  //     throw new Error('Failed to read package.json');
  //   }
  // }

  private async fetchPackageInfo(packageName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `https://registry.npmjs.org/${packageName}`;
      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  private async getOutdatedFast(packageJson: any): Promise<Record<string, NpmOutdatedInfo>> {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const outdated: Record<string, NpmOutdatedInfo> = {};

    // Fetch all package info in parallel
    const promises = Object.entries(deps).map(async ([name, range]) => {
      try {
        const info = await this.fetchPackageInfo(name);
        const latest = info['dist-tags']?.latest;
        const current = this.extractVersionFromRange(range as string);
        
        if (current && latest && semver.gt(latest, current)) {
          outdated[name] = {
            current,
            wanted: latest,
            latest,
            location: ''
          };
        }
      } catch (error) {
        // Silently skip packages that fail
      }
    });

    await Promise.all(promises);
    return outdated;
  }

  private extractVersionFromRange(range: string): string | null {
    // Remove version range operators (^, ~, >=, etc.)
    const cleaned = range.replace(/[\^~>=<]/g, '').trim();
    return semver.valid(cleaned);
  }

  // private async getNpmOutdated(): Promise<Record<string, NpmOutdatedInfo>> {
  //   try {
  //     const { stdout } = await execPromise('npm outdated --json', {
  //       cwd: path.dirname(this.packageJsonPath),
  //       maxBuffer: 1024 * 1024 * 10 // 10MB buffer
  //     });
  //     return JSON.parse(stdout);
  //   } catch (error: any) {
  //     // npm outdated exits with code 1 when packages are outdated
  //     if (error.stdout) {
  //       try {
  //         return JSON.parse(error.stdout);
  //       } catch {
  //         return {};
  //       }
  //     }
  //     return {};
  //   }
  // }

  private async getNpmAudit(): Promise<any> {
    try {
      const { stdout } = await execPromise('npm audit --json', {
        cwd: path.dirname(this.packageJsonPath),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      return JSON.parse(stdout);
    } catch (error: any) {
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          return { vulnerabilities: {} };
        }
      }
      return { vulnerabilities: {} };
    }
  }

  // ========================================
  // PRIVATE METHODS - SEMVER OPERATIONS
  // ========================================

  private buildOutdatedList(
    npmOutdated: Record<string, NpmOutdatedInfo>,
    _packageJson: any
  ): OutdatedPackage[] {
    const outdatedList: OutdatedPackage[] = [];

    for (const [pkgName, pkgInfo] of Object.entries(npmOutdated)) {
      const current = pkgInfo.current;
      const latest = pkgInfo.latest;

      // Validate versions
      if (!semver.valid(current) || !semver.valid(latest)) {
        console.warn(`Invalid semver for ${pkgName}: current=${current}, latest=${latest}`);
        continue;
      }

      // Determine update type (major/minor/patch)
      const updateType = this.determineUpdateType(current, latest);

      outdatedList.push({
        package: pkgName,
        current: current,
        latest: latest,
        type: updateType
      });
    }

    return outdatedList;
  }

  private determineUpdateType(currentVersion: string, latestVersion: string): 'major' | 'minor' | 'patch' {
    try {
      // Clean versions (removes 'v' prefix if present)
      const current = semver.clean(currentVersion);
      const latest = semver.clean(latestVersion);

      if (!current || !latest) {
        return 'patch';
      }

      // Using semver.diff() - Most straightforward
      const diffType = semver.diff(current, latest);

      if (diffType === 'major' || diffType === 'premajor') {
        return 'major';
      } else if (diffType === 'minor' || diffType === 'preminor') {
        return 'minor';
      } else if (diffType === 'patch' || diffType === 'prepatch') {
        return 'patch';
      }

      return 'patch'; // Default fallback
    } catch (error) {
      return 'patch';
    }
  }

  private calculateVersionDistance(current: string, latest: string): VersionDistance {
    try {
      const curr = semver.clean(current);
      const lat = semver.clean(latest);

      if (!curr || !lat) {
        return {
          majorVersionsBehind: 0,
          minorVersionsBehind: 0,
          patchVersionsBehind: 0,
          totalDistance: 0
        };
      }

      const majorDiff = semver.major(lat) - semver.major(curr);
      const minorDiff = semver.minor(lat) - semver.minor(curr);
      const patchDiff = semver.patch(lat) - semver.patch(curr);

      return {
        majorVersionsBehind: majorDiff,
        minorVersionsBehind: majorDiff === 0 ? minorDiff : 0,
        patchVersionsBehind: majorDiff === 0 && minorDiff === 0 ? patchDiff : 0,
        totalDistance: majorDiff * 10000 + minorDiff * 100 + patchDiff
      };
    } catch (error) {
      return {
        majorVersionsBehind: 0,
        minorVersionsBehind: 0,
        patchVersionsBehind: 0,
        totalDistance: 0
      };
    }
  }

  // ========================================
  // PRIVATE METHODS - VULNERABILITY PROCESSING
  // ========================================

  // private processVulnerabilities(npmAudit: any): Vulnerability[] {
  //   const vulnerabilities: Vulnerability[] = [];

  //   try {
  //     if (npmAudit.vulnerabilities) {
  //       for (const [pkg, vulnInfo] of Object.entries<any>(npmAudit.vulnerabilities)) {
  //         if (vulnInfo.via && Array.isArray(vulnInfo.via)) {
  //           vulnInfo.via.forEach((via: any) => {
  //             if (typeof via === 'object' && via.source) {
  //               vulnerabilities.push({
  //                 id: via.source.toString(),
  //                 package: pkg,
  //                 version: via.range || 'unknown',
  //                 severity: via.severity || 'unknown',
  //                 description: via.title || 'No description available',
  //                 fixedIn: vulnInfo.fixAvailable?.version || 'unknown'
  //               });
  //             }
  //           });
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error processing vulnerabilities:', error);
  //   }

  //   return vulnerabilities;
  // }

  // ========================================
  // PRIVATE METHODS - HEALTH SCORE
  // ========================================

  private calculateHealthScore(report: DependencyReport): number {
    let score = 100;

    // Vulnerability penalties
    score -= report.summary.critical * 15;
    score -= report.summary.high * 10;
    score -= report.summary.moderate * 5;
    score -= report.summary.low * 2;

    // Outdated package penalties (using semver analysis)
    report.outdated.forEach(pkg => {
      const distance = this.calculateVersionDistance(pkg.current, pkg.latest);

      if (pkg.type === 'major') {
        score -= distance.majorVersionsBehind * 5;
      } else if (pkg.type === 'minor') {
        score -= distance.minorVersionsBehind * 2;
      } else if (pkg.type === 'patch') {
        score -= distance.patchVersionsBehind * 1;
      }
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ========================================
  // PUBLIC UTILITY METHODS
  // ========================================

  /**
   * Sort outdated packages by priority
   */
  public sortOutdatedByPriority(outdatedList: OutdatedPackage[]): OutdatedPackage[] {
    return outdatedList.sort((a, b) => {
      return semver.compare(a.current, b.current);
    });
  }

  /**
   * Check if version satisfies range
   */
  public checkVersionRange(version: string, range: string): boolean {
    try {
      return semver.satisfies(version, range);
    } catch (error) {
      return false;
    }
  }

  /**
   * Analyze version components
   */
  public analyzeVersion(version: string): any {
    try {
      const cleanVersion = semver.clean(version);
      if (!cleanVersion) return null;

      return {
        major: semver.major(cleanVersion),
        minor: semver.minor(cleanVersion),
        patch: semver.patch(cleanVersion),
        prerelease: semver.prerelease(cleanVersion),
        version: cleanVersion
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find best version in range
   */
  public getBestVersionInRange(versions: string[], range: string): string | null {
    try {
      return semver.maxSatisfying(versions, range);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for breaking changes
   */
  public hasBreakingChanges(current: string, latest: string): boolean {
    try {
      const curr = semver.clean(current);
      const lat = semver.clean(latest);
      if (!curr || !lat) return false;
      return semver.major(curr) < semver.major(lat);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate version strings in package.json
   */
  public validateVersions(packageJson: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    for (const [pkg, versionRange] of Object.entries<string>(allDeps)) {
      if (!semver.validRange(versionRange)) {
        errors.push(`Invalid version range for ${pkg}: ${versionRange}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Find newest version from array
   */
  public findNewestVersion(versions: string[]): string | null {
    try {
      const sorted = semver.rsort(versions);
      return sorted[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Coerce version string to valid semver
   */
  public coerceVersion(versionString: string): string | null {
    try {
      const coerced = semver.coerce(versionString);
      return coerced ? coerced.version : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if versions are compatible (same major version)
   */
  public areVersionsCompatible(version1: string, version2: string): boolean {
    try {
      const v1 = semver.clean(version1);
      const v2 = semver.clean(version2);
      if (!v1 || !v2) return false;
      return semver.major(v1) === semver.major(v2);
    } catch (error) {
      return false;
    }
  }

  public async generateVulnerabilityReport(packageJson: any): Promise<Vulnerability[]> {
    try {
      console.log('Generating vulnerability report for package.json:', packageJson.name);

      // Get npm audit data
      const npmAudit = await this.getNpmAuditFast(packageJson);

      // Process vulnerabilities
      const vulnerabilities = this.processVulnerabilities(npmAudit);

      return vulnerabilities;
    } catch (error) {
      console.error('Error generating vulnerability report:', error);
      return [];
    }
  }

  private async getNpmAuditFast(packageJson: any): Promise<any> {
    try {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const vulnerabilities: any = {};

      // Fetch vulnerability data for each package
      const promises = Object.entries(deps).map(async ([name, version]) => {
        try {
          const pkgInfo = await this.fetchPackageInfo(name);
          const currentVersion = this.extractVersionFromRange(version as string);

          if (!currentVersion) return;

          // Check for known vulnerabilities in package metadata
          if (pkgInfo.versions && pkgInfo.versions[currentVersion]) {
            const versionData = pkgInfo.versions[currentVersion];
            
            // Check if package has deprecated or security warnings
            if (versionData.deprecated) {
              vulnerabilities[name] = {
                via: [{
                  source: `npm-deprecated-${name}`,
                  title: versionData.deprecated,
                  severity: 'moderate',
                  range: version
                }],
                fixAvailable: {
                  version: pkgInfo['dist-tags']?.latest || currentVersion
                }
              };
            }
          }

          // Alternative: Use npms.io API for security scores
          await this.checkNpmsIoSecurity(name, currentVersion, vulnerabilities);

        } catch (error) {
          // Silently skip packages that fail
          console.warn(`Failed to check vulnerabilities for ${name}:`, error);
        }
      });

      await Promise.all(promises);

      return { vulnerabilities };
    } catch (error) {
      console.error('Error in getNpmAuditFast:', error);
      return { vulnerabilities: {} };
    }
  }

  private async checkNpmsIoSecurity(
    packageName: string, 
    version: string, 
    vulnerabilities: any
  ): Promise<void> {
    try {
      const npmsData = await this.fetchNpmsIoData(packageName);
      
      if (npmsData?.score?.detail?.quality < 0.5 || 
          npmsData?.score?.detail?.maintenance < 0.5) {
        
        const severity = npmsData.score.detail.quality < 0.3 ? 'high' : 'moderate';
        
        if (!vulnerabilities[packageName]) {
          vulnerabilities[packageName] = {
            via: [],
            fixAvailable: { version: 'latest' }
          };
        }

        vulnerabilities[packageName].via.push({
          source: 'npms-quality-check',
          title: `Low quality/maintenance score detected`,
          severity: severity,
          range: version
        });
      }

      // Check if package has known vulnerabilities flag
      if (npmsData?.collected?.metadata?.hasVulnerabilities) {
        if (!vulnerabilities[packageName]) {
          vulnerabilities[packageName] = {
            via: [],
            fixAvailable: { version: 'latest' }
          };
        }

        vulnerabilities[packageName].via.push({
          source: 'npms-vulnerability-flag',
          title: 'Package flagged with known vulnerabilities',
          severity: 'high',
          range: version
        });
      }
    } catch (error) {
      // Silently fail - this is supplementary data
    }
  }

  private async fetchNpmsIoData(packageName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `https://api.npms.io/v2/package/${encodeURIComponent(packageName)}`;
      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
  }

  private processVulnerabilities(npmAudit: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      if (npmAudit.vulnerabilities) {
        for (const [pkg, vulnInfo] of Object.entries<any>(npmAudit.vulnerabilities)) {
          if (vulnInfo.via && Array.isArray(vulnInfo.via)) {
            vulnInfo.via.forEach((via: any) => {
              if (typeof via === 'object' && (via.source || via.title)) {
                vulnerabilities.push({
                  id: via.source?.toString() || `vuln-${pkg}-${Date.now()}`,
                  package: pkg,
                  version: via.range || 'unknown',
                  severity: this.normalizeSeverity(via.severity),
                  description: via.title || 'No description available',
                  fixedIn: vulnInfo.fixAvailable?.version || 'Check npm registry'
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing vulnerabilities:', error);
    }

    return vulnerabilities;
  }

  private normalizeSeverity(severity: string | undefined): 'critical' | 'high' | 'moderate' | 'low' | 'unknown' {
    if (!severity) return 'unknown';
    
    const normalized = severity.toLowerCase();
    if (['critical', 'high', 'moderate', 'low'].includes(normalized)) {
      return normalized as 'critical' | 'high' | 'moderate' | 'low';
    }
    
    return 'unknown';
  }

}
