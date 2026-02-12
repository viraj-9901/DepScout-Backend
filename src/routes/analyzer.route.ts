import { Router } from 'express';
import { AnalyzerController } from '../controllers/analyzer.controller';
import {
  validatePackageJsonData,
  validateVersionCheck,
  validateOutputPath,
  analyzerErrorHandler
} from '../middleware/analyzer.middleware';

const router = Router();
const analyzerController = new AnalyzerController();

/**
 * @route   POST /api/analyzer/report
 * @desc    Generate dependency report
 * @access  Public
 */
router.post(
  '/report',
  validatePackageJsonData,
  analyzerController.generateReport
);

/**
 * @route   POST /api/analyzer/report/save
 * @desc    Generate and save dependency report to file
 * @access  Public
 */
router.post(
  '/report/save',
  validatePackageJsonData,
  validateOutputPath,
  analyzerController.generateAndSaveReport
);

/**
 * @route   GET /api/analyzer/health-score
 * @desc    Get health score of dependencies
 * @access  Public
 */
router.get(
  '/health-score',
  validatePackageJsonData,
  analyzerController.getHealthScore
);

/**
 * @route   GET /api/analyzer/outdated
 * @desc    Get list of outdated packages
 * @access  Public
 * @query   sortByPriority - boolean to sort by priority
 */
router.get(
  '/outdated',
  validatePackageJsonData,
  analyzerController.getOutdatedPackages
);

/**
 * @route   GET /api/analyzer/vulnerabilities
 * @desc    Get list of vulnerabilities
 * @access  Public
 * @query   severity - filter by severity (critical, high, moderate, low)
 */
router.post(
  '/vulnerabilities',
  validatePackageJsonData,
  analyzerController.getVulnerabilities
);

/**
 * @route   POST /api/analyzer/validate
 * @desc    Validate version ranges in package.json
 * @access  Public
 */
router.post(
  '/validate',
  validatePackageJsonData,
  analyzerController.validateVersions
);

/**
 * @route   POST /api/analyzer/check-version
 * @desc    Check if a version satisfies a given range
 * @access  Public
 * @body    version, range
 */
router.post(
  '/check-version',
  validateVersionCheck,
  analyzerController.checkVersion
);

// Error handler - must be last
router.use(analyzerErrorHandler);

export default router;
