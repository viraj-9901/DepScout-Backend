import { Request, Response, NextFunction } from 'express';
import { AnalyzerService, DependencyReport } from '../services/analyzer.service';
import * as path from 'path';

/**
 * Controller for dependency analysis operations
 */
export class AnalyzerController {
  private analyzerService: AnalyzerService;

  constructor() {
    this.analyzerService = new AnalyzerService();
  }

  /**
   * Generate dependency report
   * @route POST /api/analyzer/report
   */
  public generateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageJsonPath } = req.body;

      console.log('Received request to generate report with packageJsonPath:', packageJsonPath);

      // Create service instance with custom path if provided
      const service = packageJsonPath 
        ? new AnalyzerService(packageJsonPath)
        : this.analyzerService;

      const report: DependencyReport = await service.generateDependencyReport(req.body);

      res.status(200).json({
        success: true,
        message: 'Dependency report generated successfully',
        data: report
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate and save dependency report to file
   * @route POST /api/analyzer/report/save
   */
  public generateAndSaveReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageJsonPath, outputPath } = req.body;

      const service = packageJsonPath 
        ? new AnalyzerService(packageJsonPath)
        : this.analyzerService;

      const report: DependencyReport = await service.generateDependencyReport();
      const filePath = await service.saveReportToFile(report, outputPath);

      res.status(200).json({
        success: true,
        message: 'Dependency report generated and saved successfully',
        data: {
          report,
          savedTo: filePath
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get health score only
   * @route GET /api/analyzer/health-score
   */
  public getHealthScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageJsonPath } = req.query;

      const service = packageJsonPath 
        ? new AnalyzerService(packageJsonPath as string)
        : this.analyzerService;

      const report: DependencyReport = await service.generateDependencyReport();

      res.status(200).json({
        success: true,
        data: {
          healthScore: report.healthScore,
          summary: report.summary
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get outdated packages
   * @route GET /api/analyzer/outdated
   */
  public getOutdatedPackages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageJsonPath, sortByPriority } = req.query;

      const service = packageJsonPath 
        ? new AnalyzerService(packageJsonPath as string)
        : this.analyzerService;

      const report: DependencyReport = await service.generateDependencyReport();
      let outdated = report.outdated;

      if (sortByPriority === 'true') {
        outdated = service.sortOutdatedByPriority(outdated);
      }

      res.status(200).json({
        success: true,
        data: {
          outdated,
          count: outdated.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get vulnerabilities
   * @route GET /api/analyzer/vulnerabilities
   */
  public getVulnerabilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const packageJsonData = req.body;
      const { severity } = req.query;

      // const service = packageJsonPath 
      //   ? new AnalyzerService(packageJsonPath as string)
      //   : this.analyzerService;

      // const report: DependencyReport = await service.generateDependencyReport();
      // Generate vulnerability report only
      let vulnerabilities = await this.analyzerService.generateVulnerabilityReport(packageJsonData);
      // let vulnerabilities = report.vulnerabilities;

      // Filter by severity if provided
      if (severity && typeof severity === 'string') {
        vulnerabilities = vulnerabilities.filter(v => v.severity === severity);
      }

      // Calculate summary
      const summary = {
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
        unknown: vulnerabilities.filter(v => v.severity === 'unknown').length,
        total: vulnerabilities.length
      };

      res.status(200).json({
        success: true,
        data: {
          vulnerabilities,
          count: vulnerabilities.length,
          summary
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validate package.json versions
   * @route POST /api/analyzer/validate
   */
  public validateVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageJsonPath } = req.body;

      const service = packageJsonPath 
        ? new AnalyzerService(packageJsonPath)
        : this.analyzerService;

      // Read package.json
      const packageJson = require(packageJsonPath || path.join(process.cwd(), 'package.json'));
      
      const validation = service.validateVersions(packageJson);

      res.status(200).json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if version satisfies range
   * @route POST /api/analyzer/check-version
   */
  public checkVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { version, range } = req.body;

      if (!version || !range) {
        res.status(400).json({
          success: false,
          message: 'Version and range are required'
        });
        return;
      }

      const satisfies = this.analyzerService.checkVersionRange(version, range);
      const hasBreaking = this.analyzerService.hasBreakingChanges(version, range);

      res.status(200).json({
        success: true,
        data: {
          version,
          range,
          satisfies,
          hasBreakingChanges: hasBreaking
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
